import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const DATA_FILE = resolve(import.meta.dirname, 'data/issues.json')

// Watcher events may report the path with different slashes/case on Windows
function isDataFile(p: string): boolean {
  return p.replace(/\\/g, '/').toLowerCase().endsWith('/data/issues.json')
}

/**
 * Dev-only file-backed issue store.
 * GET  /api/issues -> contents of data/issues.json (or [] if missing)
 * PUT  /api/issues -> overwrite data/issues.json with request body
 * External edits to the file (e.g. from Cursor) are pushed to the
 * browser via a custom websocket event so the UI refreshes live.
 */
function issuesFileApi(): Plugin {
  return {
    name: 'issues-file-api',
    configureServer(server: ViteDevServer) {
      server.watcher.add(DATA_FILE)
      const onFsEvent = (_event: string, path: string) => {
        if (isDataFile(path)) {
          server.ws.send({ type: 'custom', event: 'issues-file-changed' })
        }
      }
      server.watcher.on('all', onFsEvent)
      // Detach on restart so stale listeners from a previous config don't linger
      server.httpServer?.once('close', () => {
        server.watcher.off('all', onFsEvent)
      })

      server.middlewares.use('/api/issues', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          const body = existsSync(DATA_FILE) ? readFileSync(DATA_FILE, 'utf8') : '[]'
          res.setHeader('Content-Type', 'application/json')
          res.end(body)
          return
        }
        if (req.method === 'PUT') {
          const chunks: Buffer[] = []
          req.on('data', (c: Buffer) => chunks.push(c))
          req.on('end', () => {
            try {
              const text = Buffer.concat(chunks).toString('utf8')
              JSON.parse(text) // validate before writing
              mkdirSync(dirname(DATA_FILE), { recursive: true })
              writeFileSync(DATA_FILE, text, 'utf8')
              res.setHeader('Content-Type', 'application/json')
              res.end('{"ok":true}')
            } catch {
              res.statusCode = 400
              res.end('{"error":"invalid json"}')
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

// GitHub Pages: set VITE_BASE to '/<repo-name>/' when deploying
export default defineConfig({
  plugins: [react(), issuesFileApi()],
  base: process.env.VITE_BASE || '/',
})

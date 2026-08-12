import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Collection name -> backing JSON file (dev file mode)
const DATA_FILES: Record<string, string> = {
  trackerIssues: resolve(import.meta.dirname, 'data/issues.json'),
  trackerProjects: resolve(import.meta.dirname, 'data/projects.json'),
}

// Watcher events may report the path with different slashes/case on Windows
function isDataFile(p: string): boolean {
  const norm = p.replace(/\\/g, '/').toLowerCase()
  return norm.endsWith('/data/issues.json') || norm.endsWith('/data/projects.json')
}

/**
 * Dev-only file-backed store, one JSON file per collection.
 * GET  /api/data/<col> -> contents of the backing file (or [] if missing)
 * PUT  /api/data/<col> -> overwrite the backing file with request body
 * External edits to the files (e.g. from Cursor) are pushed to the
 * browser via a custom websocket event so the UI refreshes live.
 */
function dataFileApi(): Plugin {
  return {
    name: 'data-file-api',
    configureServer(server: ViteDevServer) {
      for (const file of Object.values(DATA_FILES)) server.watcher.add(file)
      const onFsEvent = (_event: string, path: string) => {
        if (isDataFile(path)) {
          server.ws.send({ type: 'custom', event: 'data-file-changed' })
        }
      }
      server.watcher.on('all', onFsEvent)
      // Detach on restart so stale listeners from a previous config don't linger
      server.httpServer?.once('close', () => {
        server.watcher.off('all', onFsEvent)
      })

      server.middlewares.use('/api/data', (req: IncomingMessage, res: ServerResponse) => {
        const col = (req.url ?? '').replace(/^\//, '').split('?')[0]
        const file = DATA_FILES[col]
        if (!file) {
          res.statusCode = 404
          res.end('{"error":"unknown collection"}')
          return
        }
        if (req.method === 'GET') {
          const body = existsSync(file) ? readFileSync(file, 'utf8') : '[]'
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
              mkdirSync(dirname(file), { recursive: true })
              writeFileSync(file, text, 'utf8')
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
  plugins: [react(), dataFileApi()],
  base: process.env.VITE_BASE || '/',
})

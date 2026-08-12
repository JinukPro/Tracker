import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { getDb, isFirebaseConfigured } from './firebase'

/**
 * Storage abstraction with three backends, picked automatically:
 * - 'firebase': Firebase env configured -> Firestore (multi-user)
 * - 'file':     dev server file API available -> Tracker/data/<col>.json
 *               (editable directly from Cursor, git-trackable)
 * - 'local':    fallback -> browser localStorage (e.g. static production build)
 */

export type StorageMode = 'firebase' | 'file' | 'local'
export type DocData = Record<string, unknown>
export type StoredDoc = DocData & { id: string }

const LOCAL_PREFIX = 'tracker:'

function apiUrl(col: string): string {
  return `${import.meta.env.BASE_URL}api/data/${col}`
}

let modePromise: Promise<StorageMode> | null = null

export function getStorageMode(): Promise<StorageMode> {
  if (!modePromise) {
    modePromise = (async () => {
      if (isFirebaseConfigured) return 'firebase'
      try {
        const res = await fetch(apiUrl('trackerIssues'))
        const type = res.headers.get('content-type') ?? ''
        if (res.ok && type.includes('application/json')) return 'file'
      } catch {
        // dev API not reachable
      }
      return 'local'
    })()
  }
  return modePromise
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

// --- file backend ---

async function fileRead(col: string): Promise<StoredDoc[]> {
  const res = await fetch(apiUrl(col))
  const data = (await res.json()) as StoredDoc[]
  return Array.isArray(data) ? data : []
}

async function fileWrite(col: string, docs: StoredDoc[]): Promise<void> {
  await fetch(apiUrl(col), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docs, null, 2),
  })
}

// --- localStorage backend ---

function localRead(col: string): StoredDoc[] {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + col)
    return raw ? (JSON.parse(raw) as StoredDoc[]) : []
  } catch {
    return []
  }
}

function localWrite(col: string, docs: StoredDoc[]): void {
  localStorage.setItem(LOCAL_PREFIX + col, JSON.stringify(docs))
}

// --- public API ---

export async function listAll(col: string): Promise<StoredDoc[]> {
  const mode = await getStorageMode()
  if (mode === 'file') return fileRead(col)
  if (mode === 'local') return localRead(col)
  const snap = await getDocs(collection(getDb(), col))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addOne(col: string, data: DocData): Promise<string> {
  const mode = await getStorageMode()
  if (mode === 'file' || mode === 'local') {
    const docs = mode === 'file' ? await fileRead(col) : localRead(col)
    const id = newId()
    docs.push({ ...data, id })
    if (mode === 'file') await fileWrite(col, docs)
    else localWrite(col, docs)
    return id
  }
  const ref = await addDoc(collection(getDb(), col), data)
  return ref.id
}

export async function updateOne(col: string, id: string, patch: DocData): Promise<void> {
  const mode = await getStorageMode()
  if (mode === 'file' || mode === 'local') {
    const docs = mode === 'file' ? await fileRead(col) : localRead(col)
    const idx = docs.findIndex((d) => d.id === id)
    if (idx >= 0) {
      docs[idx] = { ...docs[idx], ...patch, id }
      if (mode === 'file') await fileWrite(col, docs)
      else localWrite(col, docs)
    }
    return
  }
  await updateDoc(doc(getDb(), col, id), patch)
}

export async function removeOne(col: string, id: string): Promise<void> {
  const mode = await getStorageMode()
  if (mode === 'file' || mode === 'local') {
    const docs = (mode === 'file' ? await fileRead(col) : localRead(col)).filter((d) => d.id !== id)
    if (mode === 'file') await fileWrite(col, docs)
    else localWrite(col, docs)
    return
  }
  await deleteDoc(doc(getDb(), col, id))
}

/** Replace the whole collection at once (used by seeding / import / reset). */
export async function setAll(col: string, datas: DocData[]): Promise<void> {
  const mode = await getStorageMode()
  const docs = datas.map((d) => ({ ...d, id: typeof d.id === 'string' && d.id ? (d.id as string) : newId() }))
  if (mode === 'file') {
    await fileWrite(col, docs)
    return
  }
  if (mode === 'local') {
    localWrite(col, docs)
    return
  }
  // Firestore: batched writes (500 ops each) instead of one round trip per doc
  const db = getDb()
  const existing = await getDocs(collection(db, col))
  const commits: Promise<void>[] = []
  let batch = writeBatch(db)
  let ops = 0
  const flush = () => {
    if (ops > 0) {
      commits.push(batch.commit())
      batch = writeBatch(db)
      ops = 0
    }
  }
  for (const d of existing.docs) {
    batch.delete(d.ref)
    if (++ops === 500) flush()
  }
  for (const d of docs) {
    const { id: _id, ...rest } = d
    batch.set(doc(collection(db, col)), rest)
    if (++ops === 500) flush()
  }
  flush()
  await Promise.all(commits)
}

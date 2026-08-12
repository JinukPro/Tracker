import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { getDb, isFirebaseConfigured } from './firebase'

/**
 * Storage abstraction with three backends, picked automatically:
 * - 'firebase': Firebase env configured -> Firestore (multi-user)
 * - 'file':     dev server file API available -> Tracker/data/issues.json
 *               (editable directly from Cursor, git-trackable)
 * - 'local':    fallback -> browser localStorage (e.g. static production build)
 */

export type StorageMode = 'firebase' | 'file' | 'local'
export type DocData = Record<string, unknown>
export type StoredDoc = DocData & { id: string }

const API_URL = `${import.meta.env.BASE_URL}api/issues`
const LOCAL_PREFIX = 'tracker:'

let modePromise: Promise<StorageMode> | null = null

export function getStorageMode(): Promise<StorageMode> {
  if (!modePromise) {
    modePromise = (async () => {
      if (isFirebaseConfigured) return 'firebase'
      try {
        const res = await fetch(API_URL)
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

async function fileRead(): Promise<StoredDoc[]> {
  const res = await fetch(API_URL)
  const data = (await res.json()) as StoredDoc[]
  return Array.isArray(data) ? data : []
}

async function fileWrite(docs: StoredDoc[]): Promise<void> {
  await fetch(API_URL, {
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
  if (mode === 'file') return fileRead()
  if (mode === 'local') return localRead(col)
  const snap = await getDocs(collection(getDb(), col))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addOne(col: string, data: DocData): Promise<string> {
  const mode = await getStorageMode()
  if (mode === 'file' || mode === 'local') {
    const docs = mode === 'file' ? await fileRead() : localRead(col)
    const id = newId()
    docs.push({ ...data, id })
    if (mode === 'file') await fileWrite(docs)
    else localWrite(col, docs)
    return id
  }
  const ref = await addDoc(collection(getDb(), col), data)
  return ref.id
}

export async function updateOne(col: string, id: string, patch: DocData): Promise<void> {
  const mode = await getStorageMode()
  if (mode === 'file' || mode === 'local') {
    const docs = mode === 'file' ? await fileRead() : localRead(col)
    const idx = docs.findIndex((d) => d.id === id)
    if (idx >= 0) {
      docs[idx] = { ...docs[idx], ...patch, id }
      if (mode === 'file') await fileWrite(docs)
      else localWrite(col, docs)
    }
    return
  }
  await updateDoc(doc(getDb(), col, id), patch)
}

export async function removeOne(col: string, id: string): Promise<void> {
  const mode = await getStorageMode()
  if (mode === 'file' || mode === 'local') {
    const docs = (mode === 'file' ? await fileRead() : localRead(col)).filter((d) => d.id !== id)
    if (mode === 'file') await fileWrite(docs)
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
    await fileWrite(docs)
    return
  }
  if (mode === 'local') {
    localWrite(col, docs)
    return
  }
  const existing = await getDocs(collection(getDb(), col))
  for (const d of existing.docs) {
    await deleteDoc(d.ref)
  }
  for (const d of docs) {
    const { id: _id, ...rest } = d
    await addDoc(collection(getDb(), col), rest)
  }
}

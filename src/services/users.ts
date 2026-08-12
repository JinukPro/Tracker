import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import type { UserProfile } from '../types'

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    uid,
    displayName: data.displayName ?? '',
    email: data.email ?? '',
    createdAt: data.createdAt ?? '',
  }
}

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
): Promise<void> {
  await setDoc(
    doc(getDb(), 'users', uid),
    { email, displayName, createdAt: new Date().toISOString() },
    { merge: true },
  )
}

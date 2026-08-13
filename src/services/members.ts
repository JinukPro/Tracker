import { addOne, listAll, removeOne, setAll, updateOne, type StoredDoc } from '../lib/store'
import { isFirebaseConfigured } from '../lib/firebase'
import type { Member } from '../types'
import { listUsers } from './users'

const COL = 'trackerMembers'

function mapMember(d: StoredDoc): Member {
  return {
    id: d.id,
    displayName: (d.displayName as string) ?? '',
    email: (d.email as string) ?? '',
    createdAt: (d.createdAt as string) ?? '',
    local: true,
  }
}

export async function listRoster(): Promise<Member[]> {
  const docs = await listAll(COL)
  return docs.map(mapMember)
}

export async function listPeople(): Promise<Member[]> {
  const roster = await listRoster()
  const byId = new Map<string, Member>()
  if (isFirebaseConfigured) {
    try {
      const users = await listUsers()
      for (const u of users) {
        byId.set(u.uid, {
          id: u.uid,
          displayName: u.displayName || u.email || '사용자',
          email: u.email,
          createdAt: u.createdAt,
          local: false,
        })
      }
    } catch (err) {
      console.warn('사용자 목록을 불러오지 못했습니다:', err)
    }
  }
  for (const m of roster) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'ko') || a.id.localeCompare(b.id),
  )
}

export async function createMember(displayName: string, email = ''): Promise<string> {
  const name = displayName.trim()
  if (!name) throw new Error('이름이 비어 있습니다.')
  return addOne(COL, { displayName: name, email, createdAt: new Date().toISOString() })
}

export async function updateMember(
  id: string,
  patch: Partial<Pick<Member, 'displayName' | 'email'>>,
): Promise<void> {
  await updateOne(COL, id, patch)
}

export async function deleteMember(id: string): Promise<void> {
  await removeOne(COL, id)
}

export async function replaceAllMembers(members: Member[]): Promise<void> {
  await setAll(
    COL,
    members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      email: m.email,
      createdAt: m.createdAt || new Date().toISOString(),
    })),
  )
}

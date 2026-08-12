import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { createUserProfile, getUserProfile } from '../services/users'
import type { UserProfile } from '../types'

const LOCAL_PROFILE: UserProfile = {
  uid: 'local',
  displayName: '로컬 사용자',
  email: '',
  createdAt: '',
}

type AuthContextValue = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  /** true when Firebase env is missing and the app runs on localStorage */
  localMode: boolean
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function ensureProfile(user: User): Promise<UserProfile | null> {
  const existing = await getUserProfile(user.uid)
  if (existing) return existing
  await createUserProfile(
    user.uid,
    user.email ?? '',
    user.displayName || user.email || '사용자',
  )
  return getUserProfile(user.uid)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(
    isFirebaseConfigured ? null : LOCAL_PROFILE,
  )
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, async (next) => {
      setUser(next)
      if (next) {
        try {
          const p = await ensureProfile(next)
          setProfile(p)
        } catch {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const loginWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    const cred = await signInWithPopup(auth, provider)
    const p = await ensureProfile(cred.user)
    setProfile(p)
  }, [])

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth())
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      localMode: !isFirebaseConfigured,
      loginWithGoogle,
      logout,
    }),
    [user, profile, loading, loginWithGoogle, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

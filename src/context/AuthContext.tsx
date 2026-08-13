import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
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
  loginWithEmail: (email: string, password: string) => Promise<void>
  signupWithEmail: (email: string, password: string, displayName: string) => Promise<void>
  loginAsGuest: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function ensureProfile(user: User): Promise<UserProfile | null> {
  const existing = await getUserProfile(user.uid)
  if (existing) return existing
  const email = user.email ?? ''
  const fallbackName = user.isAnonymous ? '게스트' : '사용자'
  const displayName = user.displayName || user.email || fallbackName
  await createUserProfile(user.uid, email, displayName)
  // Build the profile locally instead of re-fetching it
  return { uid: user.uid, displayName, email, createdAt: new Date().toISOString() }
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

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    const cred = await signInWithEmailAndPassword(auth, email, password)
    setProfile(await ensureProfile(cred.user))
  }, [])

  const signupWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      const auth = getFirebaseAuth()
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) await updateProfile(cred.user, { displayName })
      setProfile(await ensureProfile(cred.user))
    },
    [],
  )

  const loginAsGuest = useCallback(async () => {
    const auth = getFirebaseAuth()
    const cred = await signInAnonymously(auth)
    setProfile(await ensureProfile(cred.user))
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
      loginWithEmail,
      signupWithEmail,
      loginAsGuest,
      logout,
    }),
    [user, profile, loading, loginWithGoogle, loginWithEmail, signupWithEmail, loginAsGuest, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

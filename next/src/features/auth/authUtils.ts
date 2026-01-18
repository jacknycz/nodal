import { supabase } from './supabaseClient'
import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'

export async function signInWithGoogle() {
  // Store current URL before redirect
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('authRedirectUrl', window.location.href);
  }
  const { error } = await supabase.auth.signInWithOAuth({ 
    provider: "google",
    options: {
      // Send the user back to the exact page/branch they came from
      redirectTo: typeof window !== 'undefined' ? window.location.href : undefined
    }
  })
  if (error) throw error
}

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function useSupabaseUser() {
  /**
   * IMPORTANT: This hook may be mounted hundreds of times (e.g. once per node).
   * `supabase.auth.getUser()` triggers a network request to `/auth/v1/user`, which causes
   * request storms and blocks board load. We avoid that by using `getSession()` (local)
   * plus a shared subscription + cache.
   */

  // Shared cache across all mounts of this hook (module-level state).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [user, setUser] = useState<User | null | undefined>(() => cachedUser)

  useEffect(() => {
    ensureAuthSubscription()

    let alive = true
    const onUpdate = (u: User | null) => {
      if (!alive) return
      setUser(u)
    }
    listeners.add(onUpdate)

    // Seed from session (no network)
    loadUserOnce()
      .then((u) => {
        if (!alive) return
        setUser(u)

        // Preserve existing welcome redirect behavior, but ensure it runs once per user id
        try {
          if (u?.id && typeof window !== 'undefined' && didWelcomeForUserId !== u.id) {
            didWelcomeForUserId = u.id
            try { localStorage.setItem('supabase.user.id', u.id) } catch {}
            const key = `nodal.welcome.seen.${u.id}`
            const had = localStorage.getItem('nodal.auth.hadUser') === 'true'
            if (!had) localStorage.setItem('nodal.auth.hadUser', 'true')
            const seen = localStorage.getItem(key) === 'true'
            if (!seen && window.location.pathname !== '/welcome') {
              setTimeout(() => {
                try { window.location.assign('/welcome') } catch {}
              }, 0)
            }
          }
        } catch {}
      })
      .catch(() => {
        if (!alive) return
        setUser(null)
      })

    return () => {
      alive = false
      listeners.delete(onUpdate)
    }
  }, [])

  return user
}

// ---------------- shared cache + subscription (module scope) ----------------
let cachedUser: User | null | undefined = undefined
let inFlight: Promise<User | null> | null = null
let subscribed = false
const listeners = new Set<(u: User | null) => void>()
let didWelcomeForUserId: string | null = null

async function loadUserOnce(): Promise<User | null> {
  if (cachedUser !== undefined) return cachedUser
  if (inFlight) return inFlight

  inFlight = (async () => {
    const { data } = await supabase.auth.getSession()
    const u = data?.session?.user ?? null
    cachedUser = u
    return u
  })().finally(() => {
    inFlight = null
  })

  return inFlight
}

function ensureAuthSubscription() {
  if (subscribed) return
  subscribed = true

  supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
    cachedUser = session?.user ?? null
    for (const cb of listeners) cb(cachedUser ?? null)
  })
}
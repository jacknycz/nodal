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
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user ?? null)
      // Also log the session
      const sessionResult = await supabase.auth.getSession()
      try {
        if (data.user && typeof window !== 'undefined') {
          try { localStorage.setItem('supabase.user.id', data.user.id) } catch {}
          const key = `nodal.welcome.seen.${data.user.id}`
          const had = localStorage.getItem('nodal.auth.hadUser') === 'true'
          // If first time we’ve seen a real user in this browser, mark and redirect to welcome if not seen
          if (!had) {
            localStorage.setItem('nodal.auth.hadUser', 'true')
          }
          const seen = localStorage.getItem(key) === 'true'
          if (!seen && window.location.pathname !== '/welcome') {
            // Defer to allow app layout to mount
            setTimeout(() => {
              try { window.location.assign('/welcome') } catch {}
            }, 0)
          }
        }
      } catch {}
    }
    getUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription.unsubscribe()
  }, [])

  return user
} 
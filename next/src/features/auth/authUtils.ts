import { supabase } from './supabaseClient'
import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'

export async function signInWithGoogle() {
  const redirectUrl = process.env.NODE_ENV === 'production'
    ? `${window.location.origin}/auth/callback`
    : "http://localhost:3000/auth/callback"
    
  const { error } = await supabase.auth.signInWithOAuth({ 
    provider: "google",
    options: {
      redirectTo: redirectUrl
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
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user ?? null)
      // Also log the session
      const sessionResult = await supabase.auth.getSession()
    }
    getUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription.unsubscribe()
  }, [])

  return user
} 
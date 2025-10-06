'use client'

import React from 'react'
import { getSupabaseClient } from '@/src/features/auth/supabaseClient'
import { useRouter } from 'next/navigation'
import TextInput from '@/src/components/ui/TextInput'
import Button from '@/src/components/ui/Button'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [mode, setMode] = React.useState<'idle' | 'recovery' | 'done' | 'error'>('idle')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const type = params.get('type')
      if (type === 'recovery') {
        setMode('recovery')
      } else {
        setMode('idle')
      }
    } catch {
      setMode('idle')
    }
  }, [])

  const onSubmit = async () => {
    if (password.length < 8) { setMessage('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setMessage('Passwords do not match.'); return }
    setLoading(true); setMessage(null)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMode('done')
      // Redirect back to boardroom shortly
      setTimeout(() => {
        try { router.push('/') } catch {}
      }, 1200)
    } catch (e: any) {
      setMessage(e?.message || 'Failed to update password.')
      setMode('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nodal.svg" alt="Nodal" className="w-6 h-6" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{mode === 'recovery' ? 'Reset your password' : 'Authentication'}</h1>
        </div>

        {mode === 'recovery' && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Enter a new password for your account.</p>
            <div className="space-y-3">
              <TextInput
                label="New password"
                type="password"
                value={password}
                onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                fullWidth
              />
              <TextInput
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm((e.target as HTMLInputElement).value)}
                fullWidth
              />
              {message && <div className="text-xs text-red-600 dark:text-red-400">{message}</div>}
              <div className="pt-2">
                <Button onClick={onSubmit} loading={loading} disabled={loading}>Update Password</Button>
              </div>
            </div>
          </>
        )}

        {mode === 'done' && (
          <div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">Password updated. Redirecting to the boardroom…</div>
            <Button onClick={() => router.push('/')}>Go to Boardroom now</Button>
          </div>
        )}

        {mode === 'idle' && (
          <div className="text-sm text-gray-600 dark:text-gray-400">This page is used for secure authentication callbacks.</div>
        )}

        {mode === 'error' && message && (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">{message}</div>
        )}
      </div>
    </div>
  )
}
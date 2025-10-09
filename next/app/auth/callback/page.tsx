'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../../src/features/auth/supabaseClient'
import TextInput from '../../../src/components/ui/TextInput'
import Button from '../../../src/components/ui/Button'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [mode, setMode] = React.useState<'finalizing' | 'recovery' | 'done' | 'error'>('finalizing')
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
        return
      }
    } catch {}

    const finalize = async () => {
      try {
        await supabase.auth.getSession()
      } catch {}
      let to = '/boards'
      try {
        const stored = sessionStorage.getItem('authRedirectUrl')
        if (stored) {
          to = stored
          sessionStorage.removeItem('authRedirectUrl')
        }
      } catch {}
      router.replace(to)
    }
    finalize()
  }, [router])

  const onSubmit = async () => {
    if (password.length < 8) { setMessage('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setMessage('Passwords do not match.'); return }
    setLoading(true); setMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMode('done')
      setTimeout(() => { try { router.push('/boards') } catch {} }, 1200)
    } catch (e: any) {
      setMessage(e?.message || 'Failed to update password.')
      setMode('error')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'recovery') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nodal.svg" alt="Nodal" className="w-6 h-6" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Reset your password</h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Enter a new password for your account.</p>
          <div className="space-y-3">
            <TextInput label="New password" type="password" value={password} onChange={(e) => setPassword((e.target as HTMLInputElement).value)} fullWidth />
            <TextInput label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm((e.target as HTMLInputElement).value)} fullWidth />
            {message && <div className="text-xs text-red-600 dark:text-red-400">{message}</div>}
            <div className="pt-2">
              <Button onClick={onSubmit} loading={loading} disabled={loading}>Update Password</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nodal.svg" alt="Nodal" className="w-6 h-6" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Authentication</h1>
          </div>
          <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">Password updated. Redirecting…</div>
          <Button onClick={() => router.push('/boards')}>Go to Boardroom now</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <Image src="/nodal.svg" alt="Nodal" width={72} height={72} className="mb-4 opacity-80" />
      <h1 className="text-xl font-semibold">Authentication</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Finalizing sign-in…</p>
    </div>
  )
}

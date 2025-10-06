'use client'

import React from 'react'
import { useSupabaseUser } from '../features/auth/authUtils'
import { supabase, getSupabaseClient } from '../features/auth/supabaseClient'
import Button from './ui/Button'
import TextInput from './ui/TextInput'
import Modal from './ui/Modal'
import LinkUI from './ui/Link'

function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function ProfileTab() {
  const user = useSupabaseUser()
  const [loading, setLoading] = React.useState(true)
  const [profile, setProfile] = React.useState<{ username: string | null; avatar_url: string | null; display_name: string | null } | null>(null)
  const [showUsernameModal, setShowUsernameModal] = React.useState(false)
  const [usernameInput, setUsernameInput] = React.useState('')
  const debouncedUsername = useDebounced(usernameInput, 300)
  const [checking, setChecking] = React.useState(false)
  const [available, setAvailable] = React.useState<boolean | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [resetMsg, setResetMsg] = React.useState<string | null>(null)
  const [showAvatarModal, setShowAvatarModal] = React.useState(false)
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)
  const avatarBlobRef = React.useRef<Blob | null>(null)
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [imgSize, setImgSize] = React.useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = React.useState<number>(1)
  const [minScale, setMinScale] = React.useState<number>(1)
  const [tx, setTx] = React.useState<number>(0)
  const [ty, setTy] = React.useState<number>(0)
  const [isAvatarDragOver, setIsAvatarDragOver] = React.useState(false)
  const panRef = React.useRef<{ active: boolean; sx: number; sy: number; startTx: number; startTy: number }>({ active: false, sx: 0, sy: 0, startTx: 0, startTy: 0 })
  const cropSize = 256

  React.useEffect(() => {
    const run = async () => {
      if (!user?.id) { setLoading(false); return }
      try {
        const { data, error } = await supabase.from('profiles').select('username, avatar_url, display_name').eq('id', user.id).maybeSingle()
        if (error) throw error
        setProfile(data || { username: null, avatar_url: null, display_name: null })
      } catch {
        setProfile({ username: null, avatar_url: null, display_name: null })
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [user?.id])

  React.useEffect(() => {
    const check = async () => {
      const u = debouncedUsername.trim().toLowerCase()
      if (!u || u === (profile?.username || '')) { setAvailable(null); return }
      if (!/^[a-z0-9_\.]{3,24}$/.test(u)) { setAvailable(false); return }
      setChecking(true)
      try {
        const res = await fetch(`/api/profile/username?username=${encodeURIComponent(u)}`)
        const json = await res.json()
        setAvailable(!!json.available)
      } catch {
        setAvailable(null)
      } finally {
        setChecking(false)
      }
    }
    check()
  }, [debouncedUsername, profile?.username])

  const onSaveUsername = async () => {
    if (!user?.id) return
    const u = usernameInput.trim().toLowerCase()
    if (!/^[a-z0-9_\.]{3,24}$/.test(u)) { setSaveError('Invalid username'); return }
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch('/api/profile/username', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, username: u }) })
      if (res.status === 409) { setSaveError('Username is taken'); return }
      const json = await res.json()
      if (!res.ok || !json?.ok) { setSaveError(json?.error || 'Failed to save'); return }
      setProfile((p) => ({ ...(p || { username: null, avatar_url: null, display_name: null }), username: u }))
      setShowUsernameModal(false)
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const onResetPassword = async () => {
    if (!user?.email) return
    setResetMsg(null)
    try {
      const client = getSupabaseClient()
      const { error } = await client.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/auth/callback` })
      if (error) throw error
      setResetMsg('Password reset email sent.')
    } catch (e: any) {
      setResetMsg(e?.message || 'Failed to send reset email')
    }
  }

  if (loading) return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading profile…</div>

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center text-gray-500 dark:text-gray-300">
          {/* Placeholder avatar */}
          {(profile?.avatar_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg">{(user?.email || 'U').slice(0,1).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Email</div>
          <div className="text-base text-gray-900 dark:text-gray-100">{user?.email || '—'}</div>
          <div className="mt-1">
            <LinkUI onClick={() => { setAvatarPreview(null); avatarBlobRef.current = null; setShowAvatarModal(true) }}>Edit avatar</LinkUI>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Password</div>
            <div className="text-base text-gray-900 dark:text-gray-100">••••••••</div>
          </div>
          <Button onClick={onResetPassword}>Change Password</Button>
        </div>
        {resetMsg && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{resetMsg}</div>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Username</div>
            <div className="text-base text-gray-900 dark:text-gray-100">{profile?.username || '—'}</div>
          </div>
          {profile?.username ? (
            <LinkUI onClick={() => { setUsernameInput(profile?.username || ''); setShowUsernameModal(true) }}>Edit Username</LinkUI>
          ) : (
            <Button onClick={() => { setUsernameInput(''); setShowUsernameModal(true) }}>Add Username</Button>
          )}
        </div>
      </div>

      <Modal
        open={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        title={profile?.username ? 'Edit Username' : 'Add Username'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowUsernameModal(false)}>Cancel</Button>
            <Button onClick={onSaveUsername} loading={saving} disabled={saving || available === false || !/^[a-z0-9_\.]{3,24}$/.test(usernameInput.trim())}>Save</Button>
          </>
        }
      >
        <TextInput
          label="Username"
          value={usernameInput}
          onChange={(e) => setUsernameInput((e.target as HTMLInputElement).value)}
          placeholder="yourname"
          description="3–24 chars; letters, digits, underscore and dot"
          fullWidth
        />
        <div className="mt-1 text-xs">
          {checking ? (
            <span className="text-gray-500 dark:text-gray-400">Checking availability…</span>
          ) : available === true ? (
            <span className="text-emerald-600 dark:text-emerald-400">Available</span>
          ) : available === false ? (
            <span className="text-red-600 dark:text-red-400">Taken or invalid</span>
          ) : null}
        </div>
        {saveError && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{saveError}</div>}
      </Modal>

      <Modal
        open={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        title="Edit Avatar"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowAvatarModal(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!user?.id || !imageUrl || !imgSize) return
                setSaving(true)
                setSaveError(null)
                try {
                  // Render current crop to 256x256 PNG blob
                  const canvas = document.createElement('canvas')
                  canvas.width = cropSize
                  canvas.height = cropSize
                  const ctx = canvas.getContext('2d')!
                  const img = new Image()
                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve()
                    img.onerror = reject
                    img.src = imageUrl
                  })
                  const drawW = img.width * scale
                  const drawH = img.height * scale
                  const dx = (cropSize - drawW) / 2 + tx
                  const dy = (cropSize - drawH) / 2 + ty
                  ctx.imageSmoothingQuality = 'high'
                  ctx.clearRect(0, 0, cropSize, cropSize)
                  ctx.drawImage(img, dx, dy, drawW, drawH)
                  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/png', 0.92) as any)
                  avatarBlobRef.current = blob
                  // Upload into the 'avatars' bucket at path '{userId}.png'
                  const path = `${user.id}.png`
                  const { error: upErr } = await getSupabaseClient().storage.from('avatars').upload(path, avatarBlobRef.current, { upsert: true, contentType: 'image/png' })
                  if (upErr) throw upErr
                  const { data: pub } = getSupabaseClient().storage.from('avatars').getPublicUrl(path)
                  const url = pub?.publicUrl || null
                  if (url) {
                    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
                    if (updErr) throw updErr
                    setProfile((p) => ({ ...(p || { username: null, avatar_url: null, display_name: null }), avatar_url: url }))
                  }
                  setShowAvatarModal(false)
                } catch (e: any) {
                  setSaveError(e?.message || 'Failed to upload avatar')
                } finally {
                  setSaving(false)
                }
              }}
              disabled={!imageUrl || !imgSize}
              loading={saving}
            >Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center ${isAvatarDragOver ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/10' : 'border-gray-300 dark:border-gray-700'}`}
            onDragOver={(e) => { e.preventDefault(); setIsAvatarDragOver(true) }}
            onDragLeave={() => setIsAvatarDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault(); setIsAvatarDragOver(false)
              const f = e.dataTransfer.files && e.dataTransfer.files[0]
              if (!f) return
              if (!f.type.startsWith('image/')) { setSaveError('Please upload an image.'); return }
              try {
                const url = URL.createObjectURL(f)
                const img = new Image()
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve()
                  img.onerror = reject
                  img.src = url
                })
                setImageUrl(url)
                setImgSize({ w: img.width, h: img.height })
                const coverScale = Math.max(cropSize / img.width, cropSize / img.height)
                setMinScale(coverScale)
                setScale(coverScale)
                setTx(0); setTy(0)
                setAvatarPreview(null)
              } catch {
                setSaveError('Failed to process image')
              }
            }}
          >
            <div className="text-sm text-gray-700 dark:text-gray-200">Drag & drop an image here</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">or</div>
            <div className="mt-3">
              <label className="inline-block px-3 py-1.5 rounded-md border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    if (!file.type.startsWith('image/')) { setSaveError('Please upload an image.'); (e.target as HTMLInputElement).value=''; return }
                    try {
                      const url = URL.createObjectURL(file)
                      const img = new Image()
                      await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve()
                        img.onerror = reject
                        img.src = url
                      })
                      setImageUrl(url)
                      setImgSize({ w: img.width, h: img.height })
                      const fitScale = Math.min(cropSize / img.width, cropSize / img.height)
                      setScale(fitScale)
                      setTx(0); setTy(0)
                      setAvatarPreview(null)
                    } catch {
                      setSaveError('Failed to process image')
                    }
                  }}
                />
                <span className="text-sm">Choose image</span>
              </label>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Crop (drag to pan, scroll to zoom)</div>
            <div
              className="relative border border-gray-200 dark:border-gray-700 rounded-md"
              onMouseDown={(e) => {
                if (!imageUrl) return
                panRef.current = { active: true, sx: e.clientX, sy: e.clientY, startTx: tx, startTy: ty }
              }}
              onMouseMove={(e) => {
                if (!panRef.current.active) return
                const dx = e.clientX - panRef.current.sx
                const dy = e.clientY - panRef.current.sy
                // Tentative new translation
                let nTx = panRef.current.startTx + dx
                let nTy = panRef.current.startTy + dy
                // Constrain so image covers square
                if (imgSize) {
                  const drawW = imgSize.w * scale
                  const drawH = imgSize.h * scale
                  const halfGapX = Math.max(0, (drawW - cropSize) / 2)
                  const halfGapY = Math.max(0, (drawH - cropSize) / 2)
                  const minTx = -halfGapX
                  const maxTx = halfGapX
                  const minTy = -halfGapY
                  const maxTy = halfGapY
                  nTx = Math.max(minTx, Math.min(maxTx, nTx))
                  nTy = Math.max(minTy, Math.min(maxTy, nTy))
                }
                setTx(nTx)
                setTy(nTy)
              }}
              onMouseUp={() => { panRef.current.active = false }}
              onMouseLeave={() => { panRef.current.active = false }}
              onWheel={(e) => {
                if (!imgSize) return
                const delta = -Math.sign(e.deltaY) * 0.05
                const nextScale = Math.max(minScale, Math.min(5, scale + delta))
                setScale(nextScale)
                // After scale change, also clamp tx/ty
                const drawW = imgSize.w * nextScale
                const drawH = imgSize.h * nextScale
                const halfGapX = Math.max(0, (drawW - cropSize) / 2)
                const halfGapY = Math.max(0, (drawH - cropSize) / 2)
                const minTx = -halfGapX
                const maxTx = halfGapX
                const minTy = -halfGapY
                const maxTy = halfGapY
                setTx((cur) => Math.max(minTx, Math.min(maxTx, cur)))
                setTy((cur) => Math.max(minTy, Math.min(maxTy, cur)))
              }}
              style={{ width: cropSize, height: cropSize, overflow: 'hidden', background: '#111', overscrollBehavior: 'contain' }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="to crop"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: imgSize ? imgSize.w : 'auto',
                    height: imgSize ? imgSize.h : 'auto',
                    transform: `translate(${(cropSize - (imgSize ? imgSize.w * scale : 0)) / 2 + tx}px, ${(cropSize - (imgSize ? imgSize.h * scale : 0)) / 2 + ty}px) scale(${scale})`,
                    transformOrigin: 'top left',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">Select an image…</div>
              )}
              {/* Square mask indicator */}
              <div className="pointer-events-none absolute inset-0 ring-1 ring-white/30" />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={minScale}
                max={5}
                step={0.01}
                value={scale}
                onChange={(e) => {
                  const next = parseFloat((e.target as HTMLInputElement).value)
                  setScale(next)
                  if (imgSize) {
                    const drawW = imgSize.w * next
                    const drawH = imgSize.h * next
                    const halfGapX = Math.max(0, (drawW - cropSize) / 2)
                    const halfGapY = Math.max(0, (drawH - cropSize) / 2)
                    const minTx = -halfGapX
                    const maxTx = halfGapX
                    const minTy = -halfGapY
                    const maxTy = halfGapY
                    setTx((cur) => Math.max(minTx, Math.min(maxTx, cur)))
                    setTy((cur) => Math.max(minTy, Math.min(maxTy, cur)))
                  }
                }}
                className="w-48"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!imgSize) return
                  const coverScale = Math.max(cropSize / imgSize.w, cropSize / imgSize.h)
                  setMinScale(coverScale)
                  setScale(coverScale)
                  setTx(0)
                  setTy(0)
                }}
              >Reset</Button>
            </div>
          </div>
          {saveError && <div className="text-xs text-red-600 dark:text-red-400">{saveError}</div>}
          <div className="text-xs text-gray-500 dark:text-gray-400">Max saved size 256×256. Larger uploads are center-cropped and resized.</div>
        </div>
      </Modal>
    </div>
  )
}



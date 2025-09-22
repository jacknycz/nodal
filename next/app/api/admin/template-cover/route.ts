import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const ext = (file.name.split('.').pop() || 'webp').toLowerCase()
    const safeExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(ext) ? ext : 'webp'
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${safeExt}`

    const { error: uploadError } = await admin.storage
      .from('templates')
      .upload(path, file, { contentType: file.type || `image/${safeExt}`, upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    const { data: pub } = admin.storage.from('templates').getPublicUrl(path)
    return NextResponse.json({ url: pub.publicUrl, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}



import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const pageParam = url.searchParams.get('page')
    const perPageParam = url.searchParams.get('perPage')
    const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
    const perPage = Math.min(200, Math.max(1, parseInt(perPageParam || '50', 10) || 50))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    const from = (page - 1) * perPage
    const to = from + perPage - 1

    const { data, error } = await admin
      .from('feedback')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ feedback: data || [], page, perPage, total: (data as any)?.length ?? 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json()
    const { quick, details, categories, user, board } = body || {}
    if (!quick || typeof quick !== 'string' || quick.trim().length === 0) {
      return NextResponse.json({ error: 'Quick version is required' }, { status: 400 })
    }

    const payload: any = {
      quick,
      details: details || null,
      idea: categories?.idea ? true : false,
      broken: categories?.broken ? true : false,
      user_id: user?.id || null,
      user_email: user?.email || null,
      board_id: board?.id || null,
      board_name: board?.name || null,
    }

    const { data, error } = await admin.from('feedback').insert(payload).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: data?.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json()
    const { id, done, notes } = body || {}
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const update: any = {}
    if (typeof done === 'boolean') update.done = done
    if (typeof notes === 'string') update.notes = notes
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    }

    const { error } = await admin.from('feedback').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}



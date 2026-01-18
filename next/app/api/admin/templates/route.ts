import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json()
    const { name, data, description, createdBy } = body || {}
    if (!name || !data) {
      return NextResponse.json({ error: 'Missing name or data' }, { status: 400 })
    }
    const nodeCount = Array.isArray(data?.nodes) ? data.nodes.length : 0
    const edgeCount = Array.isArray(data?.edges) ? data.edges.length : 0

    const payload: any = {
      name,
      description: description || null,
      data,
      ...(createdBy ? { created_by: createdBy } : {}),
      node_count: nodeCount,
      edge_count: edgeCount,
    }

    const { data: inserted, error } = await admin
      .from('templates')
      .insert(payload)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message, details: error }, { status: 400 })
    return NextResponse.json({ id: inserted?.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}



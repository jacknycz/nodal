import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

    // Identify current user
    const supabase = getSupabaseServiceClient()
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessionId = req.nextUrl.searchParams.get('session_id')
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription.items'] })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    if (!['paid'].includes(String(session.payment_status))) {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    // Extract subscription item id for metering
    const sub: any = session.subscription
    let itemId: string | null = null
    try {
      const items = sub?.items?.data || []
      if (items.length > 0) itemId = items[0]?.id || null
    } catch {}

    // Update profiles table
    try {
      await supabase.from('profiles').upsert({ id: user.id, role: 'Pro', stripe_subscription_item_id: itemId }, { onConflict: 'id' })
    } catch {}
    // Update auth metadata role to Pro for immediate client gating
    try {
      await supabase.auth.admin.updateUserById(user.id, { app_metadata: { role: 'Pro' } })
    } catch {}

    return NextResponse.json({ ok: true, itemId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Verification failed' }, { status: 500 })
  }
}



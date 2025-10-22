import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const pageParam = url.searchParams.get('page')
    const perPageParam = url.searchParams.get('perPage')
    const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
    const perPage = Math.min(200, Math.max(1, parseInt(perPageParam || '50', 10) || 50))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const users = (data?.users || []).map((u: any) => ({
      id: u.id as string,
      email: u.email as string | null,
      role: (u.app_metadata?.role || u.user_metadata?.role || null) as string | null,
      createdAt: u.created_at as string,
      lastSignInAt: u.last_sign_in_at as string | null,
      confirmedAt: u.confirmed_at as string | null,
      paid: false as boolean,
    }))

    // Enrich with paid status using profiles.stripe_subscription_item_id and Stripe
    try {
      const ids = users.map(u => u.id)
      const { data: profs } = await admin
        .from('profiles')
        .select('id, stripe_subscription_item_id')
        .in('id', ids)
      const byId = new Map<string, any>((profs || []).map((p: any) => [String(p.id), p]))
      const stripeKey = process.env.STRIPE_SECRET_KEY
      let stripe: Stripe | null = null
      if (stripeKey) stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

      // For each user with a subscription item, check if active
      await Promise.all(users.map(async (u) => {
        try {
          const subItemId = byId.get(u.id)?.stripe_subscription_item_id as string | null | undefined
          if (!stripe || !subItemId) { u.paid = false; return }
          const item = await stripe.subscriptionItems.retrieve(subItemId)
          const subId = typeof item.subscription === 'string' ? item.subscription : (item.subscription as any)?.id
          if (!subId) { u.paid = false; return }
          const sub = await stripe.subscriptions.retrieve(subId)
          const status = String(sub.status || '')
          const now = Math.floor(Date.now() / 1000)
          const withinPeriod = typeof sub.current_period_end === 'number' ? (now <= sub.current_period_end) : true
          u.paid = withinPeriod && ['active', 'trialing', 'past_due'].includes(status)
        } catch {
          u.paid = false
        }
      }))
    } catch {
      // ignore enrichment failures
    }

    // Some client versions don't return total; compute fallback
    const total = typeof (data as any)?.total === 'number' ? (data as any).total : users.length
    return NextResponse.json({ users, page, perPage, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)
    const { userId, role } = await req.json() as { userId: string, role: 'admin' | 'pro' | 'user' }
    if (!userId || !role) return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 })

    const normalized = role === 'admin' ? 'admin' : role === 'pro' ? 'pro' : 'user'
    const { data, error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { role: normalized } })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, user: { id: data.user?.id, app_metadata: data.user?.app_metadata } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}



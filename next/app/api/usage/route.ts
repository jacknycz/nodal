import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../src/features/storage/supabaseService'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    // Identify user
    let userId: string | null = null
    let roleFromAuth: string | null = null
    let userCreatedAt: string | null = null
    try {
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        const { data } = await supabase.auth.getUser(token)
        userId = data.user?.id || null
        userCreatedAt = (data.user as any)?.created_at || null
        try {
          // Prefer app_metadata.role; fallback to user_metadata.role
          // @ts-expect-error metadata may be any
          roleFromAuth = (data.user?.app_metadata?.role as string) || (data.user?.user_metadata?.role as string) || null
        } catch {}
      }
    } catch {}
    if (!userId) {
      const hdr = req.headers.get('x-user-id')
      if (hdr) userId = hdr
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Determine billing window start
    const now = new Date()
    let start = new Date(now.getFullYear(), now.getMonth(), 1) // fallback: calendar month

    // Fetch role and subscription item id
    let role: string = roleFromAuth || 'User'
    let subItemId: string | null = null
    try {
      const prof = await supabase.from('profiles').select('role, stripe_subscription_item_id').eq('id', userId).maybeSingle()
      const dbRole = (prof.data as any)?.role
      // Use DB role only if auth role not present
      role = String(roleFromAuth || dbRole || 'User')
      subItemId = ((prof.data as any)?.stripe_subscription_item_id as string | null) || null
    } catch {}

    const isPro = role.toLowerCase() === 'pro'

    if (isPro) {
      // Align with Stripe subscription current_period_start when available
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY
        if (stripeKey && subItemId) {
          const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
          const item = await stripe.subscriptionItems.retrieve(subItemId)
          const subscriptionId = (item as any)?.subscription as string | undefined
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId)
            const cps = (sub as any)?.current_period_start as number | undefined
            if (cps && Number.isFinite(cps)) {
              start = new Date(cps * 1000)
            }
          }
        }
      } catch {}
    } else {
      // Free users: use signup day-of-month as the window anchor
      try {
        const anchorDay = (() => {
          if (userCreatedAt) return new Date(userCreatedAt).getDate()
          return now.getDate() // fallback
        })()
        // Helper: clamp day to month length
        const clampDay = (y: number, m: number, d: number) => {
          const last = new Date(y, m + 1, 0).getDate()
          return Math.min(d, last)
        }
        const dayThisMonth = clampDay(now.getFullYear(), now.getMonth(), anchorDay)
        const candidate = new Date(now.getFullYear(), now.getMonth(), dayThisMonth)
        if (now.getDate() >= dayThisMonth) {
          start = candidate
        } else {
          const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const dayPrevMonth = clampDay(prevMonth.getFullYear(), prevMonth.getMonth(), anchorDay)
          start = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), dayPrevMonth)
        }
      } catch {}
    }
    const { data, error } = await supabase
      .from('ai_usage')
      .select('tokens_used, created_at, model')
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
    if (error) {
      // Graceful fallback if table does not exist yet (relation does not exist)
      const msg = String(error.message || '')
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return NextResponse.json({ total: 0, cap: 15000, remaining: 15000, pct: 0, records: [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const total = (data || []).reduce((s: number, r: any) => s + Number(r.tokens_used || 0), 0)

    // Map role->token cap (Free 15k, Pro 100k, Admin unlimited)
    let cap = 15000
    try {
      if (role.toLowerCase() === 'pro') cap = 100000
      if (role.toLowerCase() === 'admin') cap = Number.MAX_SAFE_INTEGER
    } catch {}

    const remaining = Math.max(0, cap - total)
    const pct = cap === Number.MAX_SAFE_INTEGER ? 0 : (total / cap)

    return NextResponse.json({ total, cap, remaining, pct, records: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch usage' }, { status: 500 })
  }
}



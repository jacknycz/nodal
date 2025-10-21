import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export const runtime = 'nodejs'

async function handle(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    const auth = req.headers.get('authorization')
    const keyParam = req.nextUrl.searchParams.get('key')
    const vercelCron = req.headers.get('x-vercel-cron') === '1'
    if (secret && !(auth === `Bearer ${secret}` || keyParam === secret || vercelCron)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return NextResponse.json({ error: 'Missing Stripe key' }, { status: 500 })
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

    const supabase = getSupabaseServiceClient()
    // Aggregate yesterday usage per user
    const end = new Date()
    end.setUTCHours(0,0,0,0)
    const start = new Date(end)
    start.setUTCDate(end.getUTCDate() - 1)

    const { data, error } = await supabase
      .from('ai_usage')
      .select('user_id, tokens_used')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const byUser = new Map<string, number>()
    for (const row of data || []) {
      const uid = String(row.user_id)
      byUser.set(uid, (byUser.get(uid) || 0) + Number(row.tokens_used || 0))
    }

    // Load subscription_item_id per user (assumes profiles has it)
    for (const [uid, tokens] of byUser.entries()) {
      if (tokens <= 0) continue
      try {
        const { data: prof } = await supabase.from('profiles').select('stripe_subscription_item_id').eq('id', uid).maybeSingle()
        const itemId = (prof as any)?.stripe_subscription_item_id
        if (!itemId) continue
        await stripe.subscriptionItems.createUsageRecord(itemId, {
          quantity: Math.ceil(tokens / 1000), // e.g., bill per 1k tokens
          timestamp: Math.floor(end.getTime() / 1000),
          action: 'set'
        })
      } catch {}
    }

    return NextResponse.json({ ok: true, users: byUser.size })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Usage report failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }



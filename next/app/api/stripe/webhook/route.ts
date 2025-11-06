import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function setUserRole(userId: string, role: 'User' | 'Pro' | 'Admin', subscriptionItemId: string | null) {
  const supabase = getSupabaseServiceClient()
  try {
    await supabase.from('profiles').upsert({ id: userId, role, stripe_subscription_item_id: subscriptionItemId }, { onConflict: 'id' })
  } catch {}
  try {
    await supabase.auth.admin.updateUserById(userId, { app_metadata: { role } })
  } catch {}
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  // Read raw body for signature verification
  let event: Stripe.Event
  try {
    const sig = req.headers.get('stripe-signature') || ''
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err?.message || 'invalid'}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = (session.client_reference_id as string) || null
        const customerId = (session.customer as string) || null
        // Expand subscription to capture item id
        let subscriptionItemId: string | null = null
        if (session.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(String(session.subscription), { expand: ['items'] })
            const items = sub?.items?.data || []
            if (items.length > 0) subscriptionItemId = items[0]?.id || null
          } catch {}
        }
        if (userId) {
          await setUserRole(userId, 'Pro', subscriptionItemId)
        }
        // Attach user id to customer metadata for future events
        if (customerId && userId) {
          try { await stripe.customers.update(customerId, { metadata: { user_id: userId } }) } catch {}
        }
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = String(sub.customer)
        let userId: string | null = null
        try {
          const cust = await stripe.customers.retrieve(customerId)
          if (!cust.deleted) {
            // @ts-expect-error metadata may exist
            userId = (cust.metadata?.user_id as string) || null
          }
        } catch {}
        if (!userId) break
        const status = sub.status
        const items = sub.items?.data || []
        const itemId = items.length > 0 ? (items[0]?.id || null) : null
        if (status === 'active' || status === 'trialing' || status === 'past_due') {
          await setUserRole(userId, 'Pro', itemId)
        } else if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
          await setUserRole(userId, 'User', null)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = String(sub.customer)
        let userId: string | null = null
        try {
          const cust = await stripe.customers.retrieve(customerId)
          if (!cust.deleted) {
            // @ts-expect-error metadata may exist
            userId = (cust.metadata?.user_id as string) || null
          }
        } catch {}
        if (userId) {
          await setUserRole(userId, 'User', null)
        }
        break
      }
      default:
        break
    }
  } catch (e: any) {
    // Log but reply 200 to avoid retries if we already updated
    console.error('Stripe webhook handling error:', e?.message)
  }

  return NextResponse.json({ received: true })
}



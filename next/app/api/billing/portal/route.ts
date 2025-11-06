import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
    const portalConfigId = process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined

    // Identify user
    const supabase = getSupabaseServiceClient()
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Find or create customer by email
    let customerId: string | null = null
    if (user.email) {
      const list = await stripe.customers.list({ email: user.email, limit: 1 })
      if (list.data.length > 0) customerId = list.data[0].id
    }
    if (!customerId) {
      const created = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } })
      customerId = created.id
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''
    const returnUrl = `${origin}/profile`
    const params: Stripe.BillingPortal.SessionCreateParams = { customer: customerId, return_url: returnUrl }
    if (portalConfigId) (params as any).configuration = portalConfigId
    const portal = await stripe.billingPortal.sessions.create(params)
    return NextResponse.json({ url: portal.url })
  } catch (e: any) {
    const msg = String(e?.message || 'Portal failed')
    // Provide a clearer hint when Billing Portal is not enabled on the account
    if (msg.toLowerCase().includes('configuration')) {
      return NextResponse.json({ error: 'Stripe Billing Portal not configured. Add STRIPE_PORTAL_CONFIGURATION_ID or enable the Customer Portal in Stripe settings.' }, { status: 500 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}



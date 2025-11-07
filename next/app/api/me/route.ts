import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../src/features/storage/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Canonical profile read (single source of truth)
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, username, display_name, role, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, subscription_status, current_period_start, current_period_end')
      .eq('id', user.id)
      .maybeSingle()

    const profile = (prof as any) || {}
    const role = profile?.role || 'User'

    // Drift reconciliation: mirror profiles.role into auth app_metadata if mismatched
    try {
      const metaRole = (user.app_metadata as any)?.role
      if (metaRole !== role) {
        await supabase.auth.admin.updateUserById(user.id, { app_metadata: { role } })
      }
    } catch {}

    return NextResponse.json({
      id: user.id,
      email: user.email,
      username: profile?.username || null,
      displayName: profile?.display_name || null,
      role,
      billing: {
        stripeCustomerId: profile?.stripe_customer_id || null,
        stripeSubscriptionId: profile?.stripe_subscription_id || null,
        stripeSubscriptionItemId: profile?.stripe_subscription_item_id || null,
        status: profile?.subscription_status || null,
        currentPeriodStart: profile?.current_period_start || null,
        currentPeriodEnd: profile?.current_period_end || null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load profile' }, { status: 500 })
  }
}



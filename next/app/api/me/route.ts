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

    // Canonical profile read (single source of truth for subscription state and optional override)
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, username, display_name, role_override, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, subscription_status, current_period_start, current_period_end')
      .eq('id', user.id)
      .maybeSingle()

    const profile = (prof as any) || {}
    // Compute effective role:
    // - If override set, use it
    // - Else Pro when subscription_status indicates an active/eligible sub
    // - Else default User
    const overrideRole: string | null = profile?.role_override || null
    const subStatus: string | null = profile?.subscription_status || null
    const isSubPro = ['active', 'trialing', 'past_due'].includes(String(subStatus || '').toLowerCase())
    let effectiveRole: 'Admin' | 'Pro' | 'User' = 'User'
    if (overrideRole && /^(admin|pro|user)$/i.test(String(overrideRole))) {
      effectiveRole = (/^admin$/i.test(overrideRole) ? 'Admin' : /^pro$/i.test(overrideRole) ? 'Pro' : 'User')
    } else {
      effectiveRole = isSubPro ? 'Pro' : 'User'
    }

    // Promote-only reconciliation: mirror effectiveRole into auth app_metadata if it's a promotion
    try {
      const metaRoleRaw = (user.app_metadata as any)?.role
      const metaRole: 'Admin' | 'Pro' | 'User' =
        /^admin$/i.test(metaRoleRaw) ? 'Admin' :
        /^pro$/i.test(metaRoleRaw) ? 'Pro' : 'User'
      const rank = (r: 'Admin' | 'Pro' | 'User') => (r === 'Admin' ? 3 : r === 'Pro' ? 2 : 1)
      if (rank(effectiveRole) > rank(metaRole)) {
        await supabase.auth.admin.updateUserById(user.id, { app_metadata: { role: effectiveRole } })
      }
    } catch {}

    return NextResponse.json({
      id: user.id,
      email: user.email,
      username: profile?.username || null,
      displayName: profile?.display_name || null,
      role: effectiveRole,
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



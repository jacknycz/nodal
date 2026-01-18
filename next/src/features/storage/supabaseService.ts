import { createClient } from '@supabase/supabase-js'

let serviceClient: ReturnType<typeof createClient> | null = null

export function getSupabaseServiceClient() {
  if (serviceClient) return serviceClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const key =
    (process.env.SUPABASE_SECRET_KEY as string) ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY as string) // legacy fallback
  if (!url || !key) throw new Error('Supabase service client env missing')
  if (!process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseService] Using legacy SUPABASE_SERVICE_ROLE_KEY; please migrate to SUPABASE_SECRET_KEY')
  }
  serviceClient = createClient(url, key, { auth: { persistSession: false } })
  return serviceClient
}



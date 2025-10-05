import { createClient } from '@supabase/supabase-js'

let serviceClient: ReturnType<typeof createClient> | null = null

export function getSupabaseServiceClient() {
  if (serviceClient) return serviceClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!url || !key) throw new Error('Supabase service client env missing')
  serviceClient = createClient(url, key, { auth: { persistSession: false } })
  return serviceClient
}



import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// Preview and local dev use the "dev" schema so they never touch production tables.
const supabaseSchema = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: supabaseSchema },
})

import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseReady = !!(URL && KEY)
export const supabase = supabaseReady ? createClient(URL, KEY) : null

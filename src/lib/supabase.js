import { createClient } from '@supabase/supabase-js'

// Clean up common paste mistakes: spaces, quotes, trailing slashes,
// /rest/v1 suffixes, or the dashboard link instead of the project URL.
const clean = (v) => String(v || '').trim().replace(/^["']+|["']+$/g, '').trim()

let url = clean(import.meta.env.VITE_SUPABASE_URL)
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

const dash = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i)
if (dash) url = `https://${dash[1]}.supabase.co`
url = url.replace(/\/(rest|auth)\/v1.*$/i, '').replace(/\/+$/, '')
if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`

let client = null
let problem = ''
if (!url || !key) {
  problem = `Missing ${!url ? 'VITE_SUPABASE_URL' : ''}${!url && !key ? ' and ' : ''}${!key ? 'VITE_SUPABASE_ANON_KEY' : ''} in Vercel.`
} else {
  try { client = createClient(url, key) }
  catch (e) { problem = `Supabase could not start: ${e.message}. URL being used: ${url}` }
}

export const supabaseReady = !!client
export const supabaseProblem = problem
export const supabaseUrlUsed = url
export const supabase = client

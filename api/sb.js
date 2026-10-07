// /api/sb: forwards every Supabase request through Vercel's server.
// The browser only talks to this site, so networks that block supabase.co still work.

const clean = (v) => String(v || '').trim().replace(/^["']+|["']+$/g, '').trim()
const baseUrl = () => {
  let u = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  const dash = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i)
  if (dash) u = `https://${dash[1]}.supabase.co`
  u = u.replace(/\/(rest|auth)\/v1.*$/i, '').replace(/\/+$/, '')
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`
  return u
}

const PASS_HEADERS = ['apikey', 'authorization', 'content-type', 'prefer', 'accept', 'accept-profile',
  'content-profile', 'x-client-info', 'range', 'range-unit', 'x-supabase-api-version']

export default async function handler(req, res) {
  const base = baseUrl()
  const path = String(req.query?.p || '')
  if (!base) return res.status(500).json({ message: 'VITE_SUPABASE_URL is not set in Vercel.', msg: 'VITE_SUPABASE_URL is not set in Vercel.' })
  if (!path.startsWith('/')) return res.status(400).json({ message: 'Bad proxy path', msg: 'Bad proxy path' })

  const headers = {}
  PASS_HEADERS.forEach(h => { if (req.headers[h]) headers[h] = req.headers[h] })

  let body
  if (!['GET', 'HEAD'].includes(req.method)) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    body = Buffer.concat(chunks)
    if (!body.length) body = undefined
  }

  try {
    const r = await fetch(base + path, { method: req.method, headers, body })
    const buf = Buffer.from(await r.arrayBuffer())
    ;['content-type', 'content-range', 'preference-applied'].forEach(h => {
      const v = r.headers.get(h); if (v) res.setHeader(h, v)
    })
    res.status(r.status).send(buf)
  } catch (e) {
    const m = `Vercel could not reach Supabase at ${base}. Check the project code in VITE_SUPABASE_URL. (${e.message})`
    res.status(502).json({ message: m, msg: m })
  }
}

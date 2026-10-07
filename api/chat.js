// /api/chat.js - Proxy to Claude / OpenAI / Gemini

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, context, model = 'claude-haiku-4-5-20251001', maxTokens = 800 } = req.body || {}
  if (!message) return res.status(400).json({ error: 'No message provided' })

  const systemPrompt = `You are EDITH, a sharp digital media analyst for Swiggy Instamart in India. Answer using Indian number formatting (Lakhs/Crores), rupee (₹) currency, and marketing KPI terminology (CPM, CTR, CPS, CPI). Be direct and actionable. Under 200 words unless asked for detail.

Current data context:
${context || 'No data loaded yet.'}`

  try {
    // ── CLAUDE ──
    if (model.startsWith('claude')) {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel.' })
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: Math.min(maxTokens, 4096),
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
        }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Claude API error' })
      return res.status(200).json({ reply: data.content?.[0]?.text || 'No response', model })
    }

    // ── OPENAI ──
    if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) {
      const key = process.env.OPENAI_API_KEY
      if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY not set in Vercel.' })
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model, max_tokens: Math.min(maxTokens, 4096),
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
        }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'OpenAI API error' })
      return res.status(200).json({ reply: data.choices?.[0]?.message?.content || 'No response', model })
    }

    // ── GEMINI ──
    if (model.startsWith('gemini')) {
      const key = process.env.GEMINI_API_KEY
      if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel.' })
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: Math.min(maxTokens, 4096) },
        }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Gemini API error' })
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
      return res.status(200).json({ reply, model })
    }

    return res.status(400).json({ error: `Unknown model: ${model}` })
  } catch (e) {
    return res.status(500).json({ error: `Server error: ${e.message}` })
  }
}

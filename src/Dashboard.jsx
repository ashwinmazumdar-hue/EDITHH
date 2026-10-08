import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Send, TrendingUp, TrendingDown, Zap, BarChart2, Target, Bot, Upload, Layers, Activity, LogOut, Shield, ChevronDown, ArrowLeft, CheckCircle, Menu, X, Search } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from './lib/supabase'
import { StarField, CursorFX, LoadingScreen, LottieLoader, CountUp, AnimatedLogo, TypingDots, Ticker, triggerWarp, tilt } from './fx.jsx'

const PALETTE = ['#00D4FF', '#7B61FF', '#00FF88', '#FFB800', '#FF3366', '#FF6B35', '#A8FF3E']
const TT = { backgroundColor: '#050d1f', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, fontFamily: 'Space Mono', fontSize: 10 }

// ─── XLSX PARSING ───────────────────────────────────────────────
const COL_ALIASES = {
  Platform:               ['platform', 'platorm', 'plaform', 'platfrom', 'ad channel', 'channel', 'network'],
  Date:                   ['date', 'day'],
  Campaign_Name:          ['campaign name', 'campaign_name'],
  Platform_Campaign_Name: ['platform campaign name', 'appsflyer campaign name'],
  Spends:                 ['spends', 'spend', 'net spends', 'cost', 'amount spent'],
  Impressions:            ['impressions', 'imps'],
  Clicks:                 ['clicks'],
  Views:                  ['views', 'completed views'],
  Installs:               ['installs'],
  Sessions:               ['sessions'],
  Add_to_Cart:            ['add to cart', 'atc'],
  First_Order:            ['first order'],
  Purchase:               ['purchase', 'purchases'],
  Market:                 ['market', 'targeting', 'city'],
  Audience:               ['audience'],
  Ad_Type:                ['adtype', 'ad type'],
  Campaign_Type:          ['campaign type'],
  Week:                   ['week'],
}

const norm = s => String(s || '').toLowerCase().trim()

const mapHeaders = (rawHeaders) => {
  const map = {}
  const hs = rawHeaders.map(norm)
  // Pass 1: exact header names win (so "Campaign Name" beats "Platform Campaign Name")
  hs.forEach((hn, i) => {
    for (const [key, aliases] of Object.entries(COL_ALIASES)) {
      if (!(key in map) && aliases.includes(hn)) map[key] = i
    }
  })
  // Pass 2: partial matches for anything still unmapped, using only free columns
  const taken = new Set(Object.values(map))
  hs.forEach((hn, i) => {
    if (taken.has(i) || !hn) return
    for (const [key, aliases] of Object.entries(COL_ALIASES)) {
      if (!(key in map) && aliases.some(a => hn.includes(a))) { map[key] = i; taken.add(i); break }
    }
  })
  return map
}

const sheetToRows = (ws, source) => {
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
  if (json.length < 2) return []

  // Score rows in first 15 to find actual headers (not title rows)
  let best = -1, bestScore = 0
  for (let i = 0; i < Math.min(json.length, 15); i++) {
    const row = json[i]
    if (!row || !row.some(c => c != null && c !== '')) continue
    const score = row.filter(c => {
      if (!c) return false
      const hn = norm(String(c))
      return Object.values(COL_ALIASES).some(aliases => aliases.some(a => hn === a || hn.includes(a)))
    }).length
    if (score > bestScore) { bestScore = score; best = i }
  }
  if (best === -1 || bestScore < 2) return []

  const rawH = json[best].map(h => h == null ? '' : String(h).trim())
  const hMap = mapHeaders(rawH)
  const get = (row, k) => { const i = hMap[k]; return i !== undefined ? row[i] : null }
  const getNum = (row, k) => {
    const v = get(row, k)
    if (v == null || v === '' || v === '-') return 0
    const n = parseFloat(String(v).replace(/[₹$, ]/g, ''))
    return isNaN(n) ? 0 : n
  }
  const getStr = (row, k) => String(get(row, k) || '').trim()

  return json.slice(best + 1).map(row => {
    if (!row || !row.some(c => c != null && c !== '')) return null
    let date = getStr(row, 'Date')
    if (date) {
      const p = new Date(date)
      if (!isNaN(p.getTime())) {
        date = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`
      } else if (/^\d{5}$/.test(date)) {
        const d = new Date(Math.round((parseInt(date) - 25569) * 86400 * 1000))
        date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
    const spends = getNum(row, 'Spends'), imp = getNum(row, 'Impressions'), clicks = getNum(row, 'Clicks'), views = getNum(row, 'Views')
    return {
      Source: source,
      Platform: getStr(row, 'Platform'),
      Date: date || '',
      Campaign_Name: getStr(row, 'Campaign_Name'),
      Platform_Campaign_Name: getStr(row, 'Platform_Campaign_Name'),
      Market: getStr(row, 'Market'),
      Audience: getStr(row, 'Audience'),
      Spends: spends,
      Impressions: imp,
      Clicks: clicks,
      Views: views,
      CTR: imp > 0 ? +((clicks / imp) * 100).toFixed(3) : 0,
      VTR: imp > 0 ? +((views / imp) * 100).toFixed(3) : 0,
      CPM: imp > 0 ? +((spends / imp) * 1000).toFixed(2) : 0,
      Installs: getNum(row, 'Installs'),
      Sessions: getNum(row, 'Sessions'),
      Add_to_Cart: getNum(row, 'Add_to_Cart'),
      First_Order: getNum(row, 'First_Order'),
      Purchase: getNum(row, 'Purchase'),
    }
  }).filter(Boolean).filter(r => r.Platform || r.Date)
}

const parseXLSX = async (file) => {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', raw: false, cellDates: false })
  let rows = []
  for (const name of wb.SheetNames) {
    const n = name.toLowerCase()
    if (n.includes('raw') && !n.includes('appsflyer')) {
      rows = [...rows, ...sheetToRows(wb.Sheets[name], 'Raw Dump')]
    } else if (n.includes('appsflyer') || n.includes('apps flyer')) {
      rows = [...rows, ...sheetToRows(wb.Sheets[name], 'AppsFlyer')]
    }
  }
  return rows
}

// ─── DATA JOIN ───────────────────────────────────────────────────
const joinByPlatformDate = (rows) => {
  const dump = rows.filter(r => r.Source === 'Raw Dump')
  const af = rows.filter(r => r.Source === 'AppsFlyer')

  const aggDump = {}
  dump.forEach(r => {
    const k = `${r.Platform}|||${r.Date}`
    if (!aggDump[k]) aggDump[k] = { Platform: r.Platform, Date: r.Date, Spends: 0, Impressions: 0, Clicks: 0, Views: 0 }
    aggDump[k].Spends += r.Spends; aggDump[k].Impressions += r.Impressions
    aggDump[k].Clicks += r.Clicks; aggDump[k].Views += r.Views
  })

  const aggAF = {}
  af.forEach(r => {
    const k = `${r.Platform}|||${r.Date}`
    if (!aggAF[k]) aggAF[k] = { Platform: r.Platform, Date: r.Date, Installs: 0, Sessions: 0, Add_to_Cart: 0, First_Order: 0, Purchase: 0 }
    aggAF[k].Installs += r.Installs; aggAF[k].Sessions += r.Sessions
    aggAF[k].Add_to_Cart += r.Add_to_Cart; aggAF[k].First_Order += r.First_Order
    aggAF[k].Purchase += r.Purchase
  })

  const keys = new Set([...Object.keys(aggDump), ...Object.keys(aggAF)])
  return [...keys].map(k => {
    const d = aggDump[k], a = aggAF[k]
    const imp = d?.Impressions || 0, spends = d?.Spends || 0, clicks = d?.Clicks || 0, views = d?.Views || 0
    const sess = a?.Sessions || 0, inst = a?.Installs || 0
    return {
      Platform: (d || a).Platform, Date: (d || a).Date,
      Spends: spends, Impressions: imp, Clicks: clicks, Views: views,
      CTR: imp > 0 ? +((clicks / imp) * 100).toFixed(3) : 0,
      VTR: imp > 0 ? +((views / imp) * 100).toFixed(3) : 0,
      CPM: imp > 0 ? +((spends / imp) * 1000).toFixed(2) : 0,
      CPS: sess > 0 ? +(spends / sess).toFixed(2) : 0,
      CPI: inst > 0 ? +(spends / inst).toFixed(2) : 0,
      Sessions: sess, Installs: inst,
      Add_to_Cart: a?.Add_to_Cart || 0, First_Order: a?.First_Order || 0, Purchase: a?.Purchase || 0,
      status: d && a ? 'matched' : d ? 'raw_only' : 'af_only',
    }
  }).sort((a, b) => new Date(a.Date) - new Date(b.Date))
}

// ─── STAR FIELD BACKGROUND ───────────────────────────────────────
// ─── KPI CARD ──────────────────────────────────────────────────
const KPICard = ({ title, value, color = '#00D4FF', big = false, sub = '', delay = 0 }) => (
  <div {...tilt(big ? 6 : 9)} className={`fx-card fx-rise ${big ? 'fx-border' : ''}`}
    style={{ '--c': color, '--d': `${delay}ms`, background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: `1px solid ${color}22`, borderRadius: 12, padding: big ? 20 : 14 }}>
    <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg,transparent,${color},transparent)`, opacity: .8 }} />
    <div style={{ position: 'absolute', top: -40, right: -40, width: 110, height: 110, borderRadius: '50%', background: `radial-gradient(circle, ${color}22, transparent 70%)` }} className="fx-float" />
    <div style={{ fontFamily: 'Space Mono', fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: big ? 10 : 8, position: 'relative' }}>{title}</div>
    <div style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: big ? 28 : 16, color: '#fff', lineHeight: 1, position: 'relative', textShadow: big ? `0 0 24px ${color}66` : 'none' }}><CountUp value={value} /></div>
    {sub && <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: color, opacity: .7, marginTop: 7, position: 'relative' }}>{sub}</div>}
  </div>
)

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function Dashboard({ user, profile, onSignOut, onAdmin }) {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterPlatforms, setFilterPlatforms] = useState(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [trendMetric, setTrendMetric] = useState('cps')
  const [toast, setToast] = useState('')
  const [importing, setImporting] = useState(null)
  const [parseLog, setParseLog] = useState(null)
  const [loadCount, setLoadCount] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [drillEntity, setDrillEntity] = useState(null)

  // Platform dropdown
  const [platDropOpen, setPlatDropOpen] = useState(false)
  const [platSearch, setPlatSearch] = useState('')
  const platRef = useRef(null)

  // AI
  const [aiMessages, setAiMessages] = useState([{ role: 'assistant', text: "Hi - I'm EDITH. Ask me anything about your campaigns: spends, CPM, CTR, CPS, platform performance, trends - anything." }])
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiModel, setAiModel] = useState('claude-haiku-4-5-20251001')
  const [aiMaxTokens, setAiMaxTokens] = useState(800)
  const chatRef = useRef(null)

  // Danger zone
  const [showNuke, setShowNuke] = useState(false)
  const [nukePw, setNukePw] = useState('')
  const [nukeErr, setNukeErr] = useState('')

  const fileRef = useRef(null)
  const isAdmin = profile?.role === 'admin'
  useEffect(() => { triggerWarp() }, [tab])
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // DB row <-> app row mapping
  const fromDb = (d) => ({
    Source: d.source, Platform: d.platform || '', Date: d.date || '',
    Campaign_Name: d.campaign_name || '', Market: d.market || '', File: d.source_file || '',
    Spends: Number(d.spends) || 0, Impressions: Number(d.impressions) || 0,
    Clicks: Number(d.clicks) || 0, Views: Number(d.views) || 0,
    Installs: Number(d.installs) || 0, Sessions: Number(d.sessions) || 0,
    Add_to_Cart: Number(d.add_to_cart) || 0, First_Order: Number(d.first_order) || 0,
    Purchase: Number(d.purchase) || 0,
  })

  // Collapse raw rows into one row per Source + Platform + Date + Campaign + Market.
  // Keeps every number intact but cuts row count heavily before saving.
  const aggregate = (rows, fileName) => {
    const g = {}
    rows.forEach(r => {
      const k = [r.Source, r.Platform, r.Date, r.Campaign_Name, r.Market].join('|||')
      if (!g[k]) g[k] = {
        source: r.Source, platform: r.Platform, date: r.Date, campaign_name: r.Campaign_Name, market: r.Market,
        spends: 0, impressions: 0, clicks: 0, views: 0, installs: 0, sessions: 0,
        add_to_cart: 0, first_order: 0, purchase: 0, source_file: fileName,
      }
      const t = g[k]
      t.spends += r.Spends; t.impressions += r.Impressions; t.clicks += r.Clicks; t.views += r.Views
      t.installs += r.Installs; t.sessions += r.Sessions; t.add_to_cart += r.Add_to_Cart
      t.first_order += r.First_Order; t.purchase += r.Purchase
    })
    return Object.values(g)
  }

  // LOAD: read every row from Supabase, 1000 at a time (Supabase caps each request at 1000)
  const loadAll = useCallback(async () => {
    setLoadError('')
    const PAGE = 1000
    let from = 0, all = []
    while (true) {
      const { data: page, error } = await supabase
        .from('campaign_rows')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) { setLoadError(error.message); console.error('Load failed:', error); break }
      all = all.concat(page.map(fromDb))
      setLoadCount(all.length)
      if (page.length < PAGE) break
      from += PAGE
    }
    setData(all)
    return all
  }, [])

  useEffect(() => { loadAll().finally(() => setLoading(false)) }, [loadAll])

  // UPLOAD: parse each file, replace that file's old rows, insert in batches of 500
  const handleUpload = useCallback(async (files) => {
    if (!isAdmin) { showToast('Admin only.'); return }
    const fileArr = Array.from(files).filter(f => /\.(xlsx|xls|xlsm)$/i.test(f.name))
    if (!fileArr.length) { showToast('Upload XLSX files only.'); return }

    let saved = 0, rawCount = 0, afCount = 0, okFiles = 0, sample = null
    const failed = []
    setImporting({ pct: 0, current: 0, total: fileArr.length, name: '', rows: 0 })

    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i]
      const basePct = (i / fileArr.length) * 100
      setImporting({ pct: Math.round(basePct), current: i + 1, total: fileArr.length, name: `Reading ${f.name}`, rows: saved })
      try {
        const parsed = await parseXLSX(f)
        if (!parsed.length) { failed.push(`${f.name} (no Raw/AppsFlyer rows found)`); continue }
        rawCount += parsed.filter(r => r.Source === 'Raw Dump').length
        afCount += parsed.filter(r => r.Source === 'AppsFlyer').length
        if (!sample) sample = parsed.find(r => r.Source === 'Raw Dump' && r.Spends > 0) || parsed[0]

        const rows = aggregate(parsed, f.name)

        // Re-uploading the same file replaces it instead of doubling the numbers
        const { error: delErr } = await supabase.from('campaign_rows').delete().eq('source_file', f.name)
        if (delErr) throw new Error(delErr.message)

        const BATCH = 500
        for (let b = 0; b < rows.length; b += BATCH) {
          const chunk = rows.slice(b, b + BATCH)
          let { error } = await supabase.from('campaign_rows').insert(chunk)
          if (error) ({ error } = await supabase.from('campaign_rows').insert(chunk)) // one retry
          if (error) throw new Error(error.message)
          saved += chunk.length
          const pct = basePct + ((b + chunk.length) / rows.length) * (100 / fileArr.length)
          setImporting({ pct: Math.min(99, Math.round(pct)), current: i + 1, total: fileArr.length, name: `Saving ${f.name}`, rows: saved })
        }
        okFiles++
      } catch (e) {
        console.error(f.name, e)
        failed.push(`${f.name} (${e.message})`)
      }
    }

    setImporting({ pct: 99, current: fileArr.length, total: fileArr.length, name: 'Refreshing from database', rows: saved })
    await loadAll()
    setParseLog({ files: okFiles, rawDump: rawCount, appsFlyer: afCount, total: saved, sample, failed, error: okFiles === 0 })
    setImporting(null)
    showToast(okFiles ? `Saved ${saved.toLocaleString('en-IN')} rows from ${okFiles} file${okFiles !== 1 ? 's' : ''}${failed.length ? `, ${failed.length} failed` : ''}` : 'Nothing saved. See the parse log below.')
  }, [isAdmin, loadAll])

  // DELETE one file's data
  const handleDeleteFile = useCallback(async (name) => {
    if (!window.confirm(`Delete all data from ${name}?`)) return
    const { error } = await supabase.from('campaign_rows').delete().eq('source_file', name)
    if (error) { showToast(`Delete failed: ${error.message}`); return }
    await loadAll()
    showToast(`Removed ${name}`)
  }, [loadAll])

  // DELETE everything
  const handleClearAll = useCallback(async () => {
    if (nukePw !== 'Evendeadiamthehero') { setNukeErr('Wrong password'); setTimeout(() => setNukeErr(''), 2000); return }
    const { error } = await supabase.from('campaign_rows').delete().gte('id', 0)
    if (error) { showToast(`Delete failed: ${error.message}`); return }
    await loadAll()
    setShowNuke(false); setNukePw('')
    showToast('All data deleted.')
  }, [nukePw, loadAll])

  // ── AI Chat ──
  const handleAskAI = useCallback(async () => {
    if (!aiQuery.trim() || aiLoading) return
    const q = aiQuery.trim()
    setAiMessages(prev => [...prev, { role: 'user', text: q }])
    setAiQuery('')
    setAiLoading(true)

    const ctx = (() => {
      const j = joinByPlatformDate(data)
      const sum = (rows) => {
        const s = rows.reduce((a, r) => ({ sp: a.sp + r.Spends, im: a.im + r.Impressions, cl: a.cl + r.Clicks, se: a.se + r.Sessions, ins: a.ins + r.Installs, pu: a.pu + r.Purchase }), { sp: 0, im: 0, cl: 0, se: 0, ins: 0, pu: 0 })
        return `spend Rs${Math.round(s.sp)}, impressions ${Math.round(s.im)}, clicks ${Math.round(s.cl)}, CTR ${s.im ? (s.cl / s.im * 100).toFixed(2) : 0}%, CPM Rs${s.im ? (s.sp / s.im * 1000).toFixed(1) : 0}, sessions ${Math.round(s.se)}, CPS Rs${s.se ? (s.sp / s.se).toFixed(2) : 'NA'}, installs ${Math.round(s.ins)}, purchases ${Math.round(s.pu)}`
      }
      const dates = j.map(r => r.Date).filter(Boolean).sort()
      const plats = [...new Set(j.map(r => r.Platform).filter(Boolean))]
      const lines = [`Data covers ${dates[0] || 'NA'} to ${dates[dates.length - 1] || 'NA'}. Today is ${new Date().toISOString().slice(0, 10)}.`, `OVERALL: ${sum(j)}`, 'BY PLATFORM:']
      plats.forEach(p => lines.push(`${p}: ${sum(j.filter(r => r.Platform === p))}`))
      lines.push('BY PLATFORM AND MONTH:')
      const months = [...new Set(j.map(r => (r.Date || '').slice(0, 7)).filter(Boolean))].sort()
      plats.forEach(p => months.forEach(m => {
        const rows = j.filter(r => r.Platform === p && (r.Date || '').startsWith(m))
        if (rows.length) lines.push(`${p} ${m}: ${sum(rows)}`)
      }))
      return lines.join('\n').slice(0, 60000)
    })()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, context: ctx, model: aiModel, maxTokens: aiMaxTokens }),
      })
      const result = await res.json()
      if (result.error) {
        setAiMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${result.error}`, isError: true }])
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', text: result.reply || 'No response', model: result.model }])
      }
    } catch (e) {
      setAiMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${e.message}`, isError: true }])
    }
    setAiLoading(false)
  }, [aiQuery, aiLoading, data, aiModel, aiMaxTokens])

  useEffect(() => { chatRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [aiMessages])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (platRef.current && !platRef.current.contains(e.target)) setPlatDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── DERIVED ──
  const platforms = useMemo(() => [...new Set(data.map(r => r.Platform).filter(Boolean))], [data])

  const filtered = useMemo(() => data.filter(r => {
    if (filterPlatforms.size > 0 && !filterPlatforms.has(r.Platform)) return false
    if (dateFrom && r.Date < dateFrom) return false
    if (dateTo && r.Date > dateTo) return false
    return true
  }), [data, filterPlatforms, dateFrom, dateTo])

  const joined = useMemo(() => joinByPlatformDate(filtered), [filtered])

  const kpis = useMemo(() => {
    const spend = joined.reduce((s, r) => s + r.Spends, 0)
    const imp = joined.reduce((s, r) => s + r.Impressions, 0)
    const clicks = joined.reduce((s, r) => s + r.Clicks, 0)
    const sess = joined.reduce((s, r) => s + r.Sessions, 0)
    const inst = joined.reduce((s, r) => s + r.Installs, 0)
    const purch = joined.reduce((s, r) => s + r.Purchase, 0)
    return {
      sessions: sess.toLocaleString('en-IN'),
      cps: sess > 0 ? `₹${(spend / sess).toFixed(1)}` : '-',
      spendCr: `₹${(spend / 1e7).toFixed(2)} Cr`,
      impM: `${(imp / 1e6).toFixed(1)}M`,
      cpm: imp > 0 ? `₹${(spend / imp * 1000).toFixed(0)}` : '-',
      ctr: imp > 0 ? `${(clicks / imp * 100).toFixed(2)}%` : '-',
      installs: inst.toLocaleString('en-IN'),
      purchase: purch.toLocaleString('en-IN'),
    }
  }, [joined])

  const trendData = useMemo(() => {
    const g = {}
    joined.forEach(r => {
      if (!g[r.Date]) g[r.Date] = { date: r.Date, spendL: 0, impM: 0, clicks: 0, sessions: 0, installs: 0 }
      g[r.Date].spendL += r.Spends / 1e5
      g[r.Date].impM += r.Impressions / 1e6
      g[r.Date].clicks += r.Clicks
      g[r.Date].sessions += r.Sessions
      g[r.Date].installs += r.Installs
    })
    return Object.values(g).sort((a, b) => new Date(a.date) - new Date(b.date)).map(d => ({
      date: d.date,
      spendL: +d.spendL.toFixed(1),
      impM: +d.impM.toFixed(2),
      cpm: d.impM > 0 ? +(d.spendL * 10 / d.impM).toFixed(1) : 0,
      ctr: d.impM > 0 ? +((d.clicks / (d.impM * 1e6)) * 100).toFixed(3) : 0,
      cps: d.sessions > 0 ? +(d.spendL * 1e5 / d.sessions).toFixed(1) : 0,
      sessions: d.sessions,
      installs: d.installs,
    }))
  }, [joined])

  const platformStats = useMemo(() => {
    const g = {}
    joined.forEach(r => {
      if (!g[r.Platform]) g[r.Platform] = { name: r.Platform, spend: 0, imp: 0, clicks: 0, sessions: 0, installs: 0, purchase: 0 }
      g[r.Platform].spend += r.Spends; g[r.Platform].imp += r.Impressions
      g[r.Platform].clicks += r.Clicks; g[r.Platform].sessions += r.Sessions
      g[r.Platform].installs += r.Installs; g[r.Platform].purchase += r.Purchase
    })
    return Object.values(g).sort((a, b) => b.spend - a.spend).map(p => ({
      ...p,
      ctr: p.imp > 0 ? +((p.clicks / p.imp) * 100).toFixed(3) : 0,
      cpm: p.imp > 0 ? +((p.spend / p.imp) * 1000).toFixed(0) : 0,
      cps: p.sessions > 0 ? +(p.spend / p.sessions).toFixed(1) : 0,
      cpi: p.installs > 0 ? +(p.spend / p.installs).toFixed(0) : 0,
    }))
  }, [joined])

  const matchReport = useMemo(() => ({
    total: joined.length,
    matched: joined.filter(r => r.status === 'matched').length,
    rawOnly: joined.filter(r => r.status === 'raw_only').length,
    afOnly: joined.filter(r => r.status === 'af_only').length,
  }), [joined])

  const NAV = [
    { id: 'overview', label: 'Overview', Icon: BarChart2 },
    { id: 'platforms', label: 'Platforms', Icon: Layers },
    { id: 'drilldown', label: 'Drilldown', Icon: Activity },
    { id: 'ai', label: 'EDITH AI', Icon: Bot },
    { id: 'import', label: 'Import', Icon: Upload },
  ]

  const isEmpty = data.length === 0

  // ─── LOADING / INITIAL ────
  if (loading) return <LoadingScreen label="LOADING EDITH" sub={loadCount > 0 ? `${loadCount.toLocaleString('en-IN')} rows loaded` : 'Connecting to database'} />

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#020610', overflow: 'hidden', position: 'relative' }}>
      <StarField />

      <CursorFX />
      <div className="fx-scanline" />

      {/* Import progress overlay */}
      {importing !== null && <LoadingScreen overlay label="EDITH IS EATING" sub="Reading and saving your files" progress={importing} />}

      {/* SIDEBAR */}
      <div style={{ width: 180, flexShrink: 0, background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(0,212,255,0.08)', display: 'flex', flexDirection: 'column', zIndex: 10, position: 'relative' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(0,212,255,0.06)' }}>
          <AnimatedLogo size={17} spacing={5} />
          <div style={{ fontFamily: 'Space Mono', fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: 3, marginTop: 2 }}>INTELLIGENCE</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(({ id, label, Icon }, ni) => {
            const active = tab === id
            return (
              <button key={id} className="fx-nav fx-slideL" onClick={() => { setTab(id); setDrillEntity(null) }} style={{ '--d': `${150 + ni * 70}ms`, boxShadow: active ? 'inset 0 0 18px rgba(0,212,255,0.12), 0 0 16px -6px #00D4FF' : 'none',
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(0,212,255,0.1)' : 'transparent',
                borderLeft: `2px solid ${active ? '#00D4FF' : 'transparent'}`,
                color: active ? '#00D4FF' : 'rgba(255,255,255,0.3)',
                fontFamily: 'Syne', fontWeight: 600, fontSize: 11, transition: 'all .15s',
              }}>
                <Icon size={13} style={{ filter: active ? 'drop-shadow(0 0 6px #00D4FF)' : 'none', transition: 'filter .3s' }} /> {label}
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(0,212,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <div className="fx-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 10px #00FF88' }} />
            <span style={{ fontFamily: 'Space Mono', fontSize: 8, color: '#00FF88', letterSpacing: 1 }}>LIVE</span>
          </div>
          <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.3)' }}><CountUp value={data.length.toLocaleString('en-IN')} /> rows</div>
          <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}><CountUp value={joined.length.toLocaleString('en-IN')} /> joined</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 2 }}>
        {/* Top bar */}
        <div style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,212,255,0.06)', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 className="fx-slideL" style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: .5 }}>Campaign <span className="fx-text-shimmer">Intelligence</span></h1>
            <p style={{ fontFamily: 'Space Mono', fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 2, letterSpacing: 2 }}>
              EDITH · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Platform multi-select */}
            <div style={{ position: 'relative' }} ref={platRef}>
              <button onClick={() => { setPlatDropOpen(o => !o); setPlatSearch('') }} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px',
                background: filterPlatforms.size > 0 ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filterPlatforms.size > 0 ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, cursor: 'pointer', minWidth: 150,
              }}>
                <Search size={11} color={filterPlatforms.size > 0 ? '#00D4FF' : 'rgba(255,255,255,0.4)'} />
                <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: filterPlatforms.size > 0 ? '#00D4FF' : 'rgba(255,255,255,0.5)', flex: 1, textAlign: 'left' }}>
                  {filterPlatforms.size === 0 ? 'All Platforms' : filterPlatforms.size === 1 ? [...filterPlatforms][0] : `${filterPlatforms.size} platforms`}
                </span>
                {filterPlatforms.size > 0 && <span onClick={e => { e.stopPropagation(); setFilterPlatforms(new Set()) }} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14 }}>×</span>}
                <ChevronDown size={10} color="rgba(255,255,255,0.3)" style={{ transform: platDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {platDropOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 999, background: '#0a1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, width: 240, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 7, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <Search size={11} color="rgba(255,255,255,0.3)" />
                      <input autoFocus value={platSearch} onChange={e => setPlatSearch(e.target.value)} placeholder="Search…" style={{ background: 'none', border: 'none', color: '#e2e8f0', fontFamily: 'Space Mono', fontSize: 10, width: '100%', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setFilterPlatforms(new Set(platforms))} style={{ flex: 1, padding: '7px 12px', background: 'none', border: 'none', color: 'rgba(0,212,255,0.7)', fontFamily: 'Space Mono', fontSize: 9, cursor: 'pointer' }}>Select all</button>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <button onClick={() => setFilterPlatforms(new Set())} style={{ flex: 1, padding: '7px 12px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontFamily: 'Space Mono', fontSize: 9, cursor: 'pointer' }}>Clear</button>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {platforms.filter(p => p.toLowerCase().includes(platSearch.toLowerCase())).map((p, i) => {
                      const checked = filterPlatforms.has(p)
                      return (
                        <div key={p} onClick={() => {
                          const next = new Set(filterPlatforms)
                          checked ? next.delete(p) : next.add(p)
                          setFilterPlatforms(next)
                        }} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer',
                          background: checked ? 'rgba(0,212,255,0.07)' : 'transparent',
                        }}>
                          <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${checked ? '#00D4FF' : 'rgba(255,255,255,0.2)'}`, background: checked ? '#00D4FF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {checked && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2" stroke="#020610" strokeWidth="1.8" strokeLinecap="round" /></svg>}
                          </div>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: PALETTE[i % PALETTE.length] }} />
                          <span style={{ fontFamily: 'Syne', fontSize: 11, fontWeight: 600, color: checked ? '#e2e8f0' : 'rgba(255,255,255,0.5)' }}>{p}</span>
                        </div>
                      )
                    })}
                    {platforms.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>No platforms yet</div>}
                  </div>
                </div>
              )}
            </div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', fontSize: 10, fontFamily: 'Space Mono' }} />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', fontSize: 10, fontFamily: 'Space Mono' }} />
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.25)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
            {onAdmin && (
              <button className="fx-btn" onClick={onAdmin} style={{ '--c': '#FFB800', background: 'none', border: '1px solid rgba(255,184,0,0.3)', borderRadius: 8, padding: '6px 11px', color: '#FFB800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Space Mono', fontSize: 9 }}>
                <Shield size={11} /> Admin
              </button>
            )}
            <button className="fx-btn" onClick={onSignOut} style={{ '--c': '#FF3366', background: 'none', border: '1px solid rgba(255,51,102,0.3)', borderRadius: 8, padding: '6px 11px', color: '#FF3366', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Space Mono', fontSize: 9 }}>
              <LogOut size={11} /> Out
            </button>
          </div>
        </div>

        <Ticker items={platformStats.slice(0, 12).map((p, i) => ({ label: p.name, color: PALETTE[i % PALETTE.length], text: `Spend Rs${(p.spend / 1e5).toFixed(1)}L  ·  CPS ${p.sessions > 0 ? 'Rs' + p.cps : 'NA'}  ·  CTR ${p.ctr}%  ·  CPM Rs${p.cpm}` }))} />

        {/* CONTENT */}
        <div key={tab} className="fx-page" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loadError && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.3)', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 10, color: '#FF3366' }}>
              Could not load data from the database: {loadError}. Check that supabase_setup.sql has been run.
            </div>
          )}
          {/* OVERVIEW */}
          {tab === 'overview' && (
            isEmpty ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', gap: 20, textAlign: 'center' }}>
                <div className="fx-float"><LottieLoader size={200} /></div>
                <div className="fx-rise" style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: '#fff', '--d': '150ms' }}>EDITH is <span className="fx-text-shimmer">hungry</span></div>
                <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Feed EDITH your data</div>
                {isAdmin && <button className="fx-btn fx-shine fx-pop" onClick={() => setTab('import')} style={{ '--d': '350ms', marginTop: 8, padding: '11px 26px', background: 'linear-gradient(135deg,#00D4FF,#0099BB)', border: 'none', borderRadius: 10, color: '#020610', fontFamily: 'Syne', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🍖 Feed EDITH</button>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
                  <KPICard delay={0} title="SESSIONS ★" value={kpis.sessions} color="#00FF88" big sub="Total sessions" />
                  <KPICard delay={80} title="CPS ★" value={kpis.cps} color="#00D4FF" big sub="Cost per session" />
                  <KPICard delay={160} title="SPEND" value={kpis.spendCr} color="#7B61FF" />
                  <KPICard delay={240} title="CPM" value={kpis.cpm} color="#FFB800" />
                  <KPICard delay={320} title="CTR" value={kpis.ctr} color="#A8FF3E" />
                  <KPICard delay={400} title="INSTALLS" value={kpis.installs} color="#FF6B35" />
                  <KPICard delay={480} title="PURCHASES" value={kpis.purchase} color="#FF3366" />
                </div>

                {/* Trend chart with metric selector */}
                <div className="fx-rise" style={{ '--d': '550ms', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 12, padding: 18, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>METRIC TREND</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[
                        { k: 'cps', label: 'CPS', c: '#00D4FF' },
                        { k: 'spendL', label: 'Spend', c: '#7B61FF' },
                        { k: 'impM', label: 'Impressions', c: '#FFB800' },
                        { k: 'cpm', label: 'CPM', c: '#FF6B35' },
                        { k: 'ctr', label: 'CTR%', c: '#00FF88' },
                        { k: 'sessions', label: 'Sessions', c: '#A8FF3E' },
                        { k: 'installs', label: 'Installs', c: '#FF3366' },
                      ].map(m => (
                        <button key={m.k} className="fx-btn" onClick={() => setTrendMetric(m.k)} style={{ '--c': m.c, boxShadow: trendMetric === m.k ? `0 0 14px -4px ${m.c}` : 'none',
                          padding: '4px 11px', borderRadius: 20,
                          border: `1px solid ${trendMetric === m.k ? m.c : 'rgba(255,255,255,0.1)'}`,
                          background: trendMetric === m.k ? `${m.c}22` : 'transparent',
                          color: trendMetric === m.k ? m.c : 'rgba(255,255,255,0.3)',
                          fontFamily: 'Space Mono', fontSize: 9, cursor: 'pointer',
                        }}>{m.label}</button>
                      ))}
                    </div>
                  </div>
                  {(() => {
                    const colors = { cps: '#00D4FF', spendL: '#7B61FF', impM: '#FFB800', cpm: '#FF6B35', ctr: '#00FF88', sessions: '#A8FF3E', installs: '#FF3366' }
                    const c = colors[trendMetric]
                    return (
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={c} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" tick={{ fontFamily: 'Space Mono', fontSize: 8 }} />
                          <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fontFamily: 'Space Mono', fontSize: 8 }} />
                          <Tooltip contentStyle={TT} />
                          <Area key={trendMetric} type="monotone" dataKey={trendMetric} stroke={c} fill="url(#grad)" strokeWidth={2.5} dot={false} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: c, style: { filter: `drop-shadow(0 0 8px ${c})` } }} animationDuration={1600} animationEasing="ease-out" style={{ filter: `drop-shadow(0 0 6px ${c}88)` }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )
                  })()}
                </div>

                {/* Platform spend */}
                <div className="fx-rise" style={{ '--d': '700ms', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 14 }}>PLATFORM SPEND BREAKDOWN</div>
                  {platformStats.slice(0, 10).map((p, i) => (
                    <div key={p.name} className="fx-slideL" style={{ marginBottom: 10, '--d': `${800 + i * 70}ms` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: PALETTE[i % PALETTE.length] }}>{p.name}</span>
                        <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>₹{(p.spend / 1e5).toFixed(1)}L · CPS ₹{p.cps}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(p.spend / platformStats[0].spend * 100).toFixed(0)}%`, background: `linear-gradient(90deg, ${PALETTE[i % PALETTE.length]}, ${PALETTE[i % PALETTE.length]}88)`, borderRadius: 2, '--d': `${900 + i * 90}ms`, boxShadow: `0 0 10px ${PALETTE[i % PALETTE.length]}` }} className="fx-grow" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* PLATFORMS */}
          {tab === 'platforms' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {platformStats.map((p, i) => {
                const c = PALETTE[i % PALETTE.length]
                return (
                  <div key={p.name} {...tilt(8)} className="fx-card fx-rise" style={{ '--c': c, '--d': `${i * 70}ms`, background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: `1px solid ${c}22`, borderRadius: 12, padding: 18 }}>
                    <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg,transparent,${c}66,transparent)` }} />
                    <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: c, letterSpacing: 2, marginBottom: 12 }}>{p.name.toUpperCase()}</div>
                    {[
                      ['Spend', `₹${(p.spend / 1e5).toFixed(1)}L`, false],
                      ['Impressions', `${(p.imp / 1e6).toFixed(2)}M`, false],
                      ['CTR', `${p.ctr}%`, false],
                      ['CPM', `₹${p.cpm}`, false],
                      ['Sessions ★', p.sessions.toLocaleString('en-IN'), true],
                      ['CPS ★', p.sessions > 0 ? `₹${p.cps}` : '-', true],
                      ['Installs', p.installs.toLocaleString('en-IN'), false],
                      ['Purchases', p.purchase.toLocaleString('en-IN'), false],
                    ].map(([l, v, prime]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: prime ? 'rgba(0,255,136,0.05)' : 'transparent', borderRadius: prime ? 4 : 0 }}>
                        <span style={{ fontFamily: 'Space Mono', fontSize: 9, color: prime ? '#00FF88' : 'rgba(255,255,255,0.3)' }}>{l}</span>
                        <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: prime ? '#00FF88' : '#fff', fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* DRILLDOWN */}
          {tab === 'drilldown' && (
            <div style={{ display: 'flex', gap: 18, height: 'calc(100vh - 130px)' }}>
              <div style={{ width: drillEntity ? 200 : '100%', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {platformStats.map((p, i) => {
                  const c = PALETTE[i % PALETTE.length]
                  const active = drillEntity === p.name
                  return (
                    <button key={p.name} className="fx-btn fx-slideL" onClick={() => setDrillEntity(active ? null : p.name)} style={{ '--c': c, '--d': `${i * 50}ms`,
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10,
                      border: `1px solid ${active ? c + '55' : 'rgba(255,255,255,0.06)'}`,
                      background: active ? `${c}12` : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0, boxShadow: `0 0 6px ${c}` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, color: active ? c : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        {!drillEntity && <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>₹{(p.spend / 1e5).toFixed(1)}L · CPS ₹{p.cps} · {p.ctr}% CTR</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
              {drillEntity && (() => {
                const rows = joined.filter(r => r.Platform === drillEntity)
                const totSpend = rows.reduce((s, r) => s + r.Spends, 0)
                const totSess = rows.reduce((s, r) => s + r.Sessions, 0)
                const totInst = rows.reduce((s, r) => s + r.Installs, 0)
                const i = platformStats.findIndex(p => p.name === drillEntity)
                const c = PALETTE[Math.max(i, 0) % PALETTE.length]
                return (
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setDrillEntity(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><ArrowLeft size={11} /></button>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${c}` }} />
                      <h2 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16, color: '#fff' }}>{drillEntity}</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                      <KPICard title="SPEND" value={`₹${(totSpend / 1e5).toFixed(1)}L`} color={c} />
                      <KPICard title="SESSIONS" value={totSess.toLocaleString('en-IN')} color="#00FF88" />
                      <KPICard title="CPS" value={totSess > 0 ? `₹${(totSpend / totSess).toFixed(1)}` : '-'} color="#00D4FF" />
                      <KPICard title="INSTALLS" value={totInst.toLocaleString('en-IN')} color="#FF6B35" />
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${c}22`, borderRadius: 12, padding: 16, overflowX: 'auto' }}>
                      <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 12 }}>DAY BY DAY</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Space Mono', fontSize: 9 }}>
                        <thead><tr>{['Date', 'Status', 'Spend', 'Impr', 'CTR%', 'CPM', 'Sessions', 'CPS', 'Installs'].map(h => (<th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: c, borderBottom: `1px solid ${c}22`, letterSpacing: 1 }}>{h}</th>))}</tr></thead>
                        <tbody>{rows.map((r, idx) => (
                          <tr key={idx} className="fx-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', '--d': `${Math.min(idx, 30) * 25}ms` }}>
                            <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.5)' }}>{r.Date}</td>
                            <td style={{ padding: '6px 10px' }}><span style={{ fontSize: 8, padding: '2px 7px', borderRadius: 10, background: r.status === 'matched' ? 'rgba(0,255,136,0.15)' : r.status === 'raw_only' ? 'rgba(255,184,0,0.15)' : 'rgba(123,97,255,0.15)', color: r.status === 'matched' ? '#00FF88' : r.status === 'raw_only' ? '#FFB800' : '#7B61FF' }}>{r.status === 'matched' ? '✓' : r.status === 'raw_only' ? 'media' : 'app'}</span></td>
                            <td style={{ padding: '6px 10px', color: '#00FF88' }}>₹{(r.Spends / 1e3).toFixed(0)}K</td>
                            <td style={{ padding: '6px 10px', color: '#e2e8f0' }}>{(r.Impressions / 1e3).toFixed(0)}K</td>
                            <td style={{ padding: '6px 10px', color: '#00D4FF' }}>{r.CTR}%</td>
                            <td style={{ padding: '6px 10px', color: '#FFB800' }}>₹{r.CPM}</td>
                            <td style={{ padding: '6px 10px', color: '#A8FF3E' }}>{r.Sessions.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '6px 10px', color: '#00D4FF' }}>{r.Sessions > 0 ? `₹${r.CPS}` : '-'}</td>
                            <td style={{ padding: '6px 10px', color: '#FF6B35' }}>{r.Installs.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* EDITH AI */}
          {tab === 'ai' && (
            <div className="fx-rise" style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 160px)' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(123,97,255,0.15)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: '#7B61FF', letterSpacing: 2 }}>EDITH - AI ANALYST</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>max tokens</span>
                    <input type="range" min={200} max={4096} step={200} value={aiMaxTokens} onChange={e => setAiMaxTokens(Number(e.target.value))} style={{ width: 70, accentColor: '#7B61FF', cursor: 'pointer' }} />
                    <span style={{ fontFamily: 'Space Mono', fontSize: 8, color: '#7B61FF', minWidth: 30 }}>{aiMaxTokens}</span>
                  </div>
                </div>

                {/* Model picker */}
                {(() => {
                  const providers = [
                    { name: 'Claude', color: '#00D4FF', models: [
                      { id: 'claude-haiku-4-5-20251001', label: '⚡ Haiku', sub: 'Fastest' },
                      { id: 'claude-sonnet-4-6', label: '🎵 Sonnet', sub: 'Balanced' },
                      { id: 'claude-opus-4-6', label: '🏆 Opus', sub: 'Best' },
                    ]},
                    { name: 'ChatGPT', color: '#00A67E', models: [
                      { id: 'gpt-4o-mini', label: '⚡ 4o mini', sub: 'Fast' },
                      { id: 'gpt-4o', label: '🧠 4o', sub: 'Smart' },
                    ]},
                    { name: 'Gemini', color: '#4285F4', models: [
                      { id: 'gemini-1.5-flash', label: '⚡ Flash', sub: 'Fast' },
                      { id: 'gemini-1.5-pro', label: '🧠 Pro', sub: 'Best' },
                    ]},
                  ]
                  const active = providers.find(p => p.models.some(m => m.id === aiModel)) || providers[0]
                  return (
                    <div style={{ marginBottom: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {providers.map(p => (
                          <button key={p.name} onClick={() => setAiModel(p.models[0].id)} style={{
                            flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                            background: active.name === p.name ? `${p.color}12` : 'transparent',
                            borderBottom: active.name === p.name ? `2px solid ${p.color}` : '2px solid transparent',
                            color: active.name === p.name ? p.color : 'rgba(255,255,255,0.3)',
                            fontFamily: 'Syne', fontWeight: 700, fontSize: 11,
                          }}>{p.name}</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, padding: 10 }}>
                        {active.models.map(m => (
                          <button key={m.id} onClick={() => setAiModel(m.id)} style={{
                            flex: 1, padding: '8px 10px', borderRadius: 8,
                            border: `1px solid ${aiModel === m.id ? active.color : 'rgba(255,255,255,0.07)'}`,
                            background: aiModel === m.id ? `${active.color}18` : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer', textAlign: 'left',
                          }}>
                            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 10, color: aiModel === m.id ? active.color : 'rgba(255,255,255,0.45)' }}>{m.label}</div>
                            <div style={{ fontFamily: 'Space Mono', fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{m.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, paddingRight: 4 }}>
                  {aiMessages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'fx-slideR' : 'fx-slideL'} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '78%', padding: '11px 15px', borderRadius: 12,
                        background: m.isError ? 'rgba(255,51,102,0.08)' : m.role === 'user' ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${m.isError ? 'rgba(255,51,102,0.3)' : m.role === 'user' ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                        fontFamily: 'Space Mono', fontSize: 11, lineHeight: 1.7,
                        color: m.isError ? '#FF3366' : '#e2e8f0', whiteSpace: 'pre-wrap',
                      }}>
                        {m.role === 'assistant' && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 8, color: '#7B61FF', letterSpacing: 2 }}>EDITH</span>
                            {m.model && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>
                              {m.model.includes('haiku') ? '⚡ Haiku' : m.model.includes('sonnet') ? '🎵 Sonnet' : m.model.includes('opus') ? '🏆 Opus' : m.model.includes('gpt-4o-mini') ? '⚡ 4o mini' : m.model.includes('gpt-4o') ? '🧠 4o' : m.model.includes('flash') ? '⚡ Flash' : '🧠 Pro'}
                            </span>}
                          </div>
                        )}
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="fx-slideL" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', alignSelf: 'flex-start', background: 'rgba(123,97,255,0.06)', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 12 }}>
                      <LottieLoader size={44} />
                      <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#7B61FF', letterSpacing: 2 }}>EDITH IS THINKING</span>
                      <TypingDots />
                    </div>
                  )}
                  <div ref={chatRef} />
                </div>

                {/* Quick suggestions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {['Which platform has the best CPS?', 'Compare CTR across platforms', 'What is my total spend YTD?', 'Top 3 platforms by sessions'].map((q, qi) => (
                    <button key={q} className="fx-btn fx-pop" onClick={() => setAiQuery(q)} style={{ '--c': '#7B61FF', '--d': `${qi * 80}ms`, padding: '4px 11px', background: 'transparent', border: '1px solid rgba(123,97,255,0.3)', borderRadius: 20, color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono', fontSize: 9, cursor: 'pointer' }}>{q}</button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={aiQuery} onChange={e => setAiQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskAI()} placeholder="Ask EDITH…" style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#e2e8f0', fontFamily: 'Space Mono', fontSize: 11, outline: 'none' }} />
                  <button className="fx-btn fx-shine" onClick={handleAskAI} disabled={aiLoading} style={{ '--c': '#7B61FF', padding: '10px 18px', background: aiLoading ? 'rgba(123,97,255,0.2)' : 'linear-gradient(135deg,#7B61FF,#5040CC)', border: 'none', borderRadius: 10, cursor: aiLoading ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Syne', fontWeight: 700, fontSize: 11 }}>
                    <Send size={12} /> Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* IMPORT */}
          {tab === 'import' && (
            !isAdmin ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 44 }}>🔒</div>
                <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: '#fff' }}>Admin Access Only</div>
                <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'rgba(255,255,255,0.3)', maxWidth: 320, lineHeight: 1.8 }}>
                  Data upload is restricted to administrators.<br />Contact your admin to import data.
                </div>
              </div>
            ) : (
              <div className="fx-rise" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Match report (animated) */}
                {joined.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 12, padding: 18 }}>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 12 }}>JOIN QUALITY REPORT</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                      {[['Total Rows', matchReport.total, '#00D4FF'], ['Matched', matchReport.matched, '#00FF88'], ['Raw Only', matchReport.rawOnly, '#FFB800'], ['AF Only', matchReport.afOnly, '#7B61FF']].map(([l, v, c]) => (
                        <div key={l} style={{ textAlign: 'center', padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${c}22` }}>
                          <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{l}</div>
                          <div style={{ fontFamily: 'Space Mono', fontSize: 20, fontWeight: 700, color: c }}>{v.toLocaleString('en-IN')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parse log */}
                {parseLog && (
                  <div style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${parseLog.error ? '#FF3366' : '#00D4FF'}22`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 10 }}>LAST PARSE</div>
                    {parseLog.failed?.length > 0 && (
                      <div style={{ marginBottom: 10, fontFamily: 'Space Mono', fontSize: 9, color: '#FF3366', lineHeight: 1.7 }}>
                        {parseLog.failed.map(f => <div key={f}>Failed: {f}</div>)}
                      </div>
                    )}
                    {parseLog.error ? (
                      <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#FF3366' }}>✗ Zero rows from {parseLog.files} files. Sheets must contain "Raw" or "AppsFlyer".</div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                          {[['Files', parseLog.files, '#00D4FF'], ['Raw Dump', parseLog.rawDump.toLocaleString('en-IN'), '#FFB800'], ['AppsFlyer', parseLog.appsFlyer.toLocaleString('en-IN'), '#7B61FF'], ['Total', parseLog.total.toLocaleString('en-IN'), '#00FF88']].map(([l, v, c]) => (
                            <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: `1px solid ${c}22` }}>
                              <div style={{ fontFamily: 'Space Mono', fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{l}</div>
                              <div style={{ fontFamily: 'Space Mono', fontSize: 14, fontWeight: 700, color: c, marginTop: 4 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {parseLog.sample && (
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontFamily: 'Space Mono', fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 7, letterSpacing: 1 }}>SAMPLE ROW</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                              {[['Platform', parseLog.sample.Platform], ['Date', parseLog.sample.Date], ['Spends', `₹${parseLog.sample.Spends.toLocaleString('en-IN')}`], ['Impressions', parseLog.sample.Impressions.toLocaleString('en-IN')]].map(([l, v]) => (
                                <div key={l}>
                                  <div style={{ fontFamily: 'Space Mono', fontSize: 7, color: 'rgba(255,255,255,0.25)' }}>{l}</div>
                                  <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: '#e2e8f0', marginTop: 2 }}>{v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Loaded files */}
                {(() => {
                  const byFile = {}
                  data.forEach(r => { const f = r.File || 'Unknown'; byFile[f] = (byFile[f] || 0) + 1 })
                  const list = Object.entries(byFile).sort((a, b) => a[0].localeCompare(b[0]))
                  if (!list.length) return null
                  return (
                    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,184,0,0.15)', borderRadius: 12, padding: 18 }}>
                      <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 12 }}>FILES IN DATABASE ({list.length})</div>
                      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {list.map(([name, count]) => (
                          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                            <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                            <span style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{count.toLocaleString('en-IN')} rows</span>
                            <button onClick={() => handleDeleteFile(name)} style={{ background: 'none', border: '1px solid rgba(255,51,102,0.3)', borderRadius: 5, padding: '3px 8px', color: '#FF3366', fontFamily: 'Space Mono', fontSize: 8, cursor: 'pointer' }}>Remove</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 10 }}>Uploading a file with the same name replaces its old data, so numbers never double up.</div>
                    </div>
                  )
                })()}

                {/* Upload */}
                <div style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 8 }}>UPLOAD XLSX FILES</div>
                  <p style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 14, lineHeight: 1.7 }}>
                    EDITH reads <span style={{ color: '#FFB800' }}>"Raw Dump- Data"</span> and <span style={{ color: '#7B61FF' }}>"AppsFlyer Raw Data"</span> tabs automatically.
                  </p>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" multiple onChange={e => handleUpload(e.target.files)} style={{ display: 'none' }} />
                  <div onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#00D4FF' }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)' }}
                    onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)'; handleUpload(e.dataTransfer.files) }}
                    className="fx-card" style={{ '--c': '#00D4FF', border: '2px dashed rgba(0,212,255,0.25)', borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: 'pointer' }}>
                    <div className="fx-float" style={{ fontSize: 34, marginBottom: 8 }}>📁</div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>Drop XLSX files or click to browse</div>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>All files merged · Raw Dump + AppsFlyer auto-detected</div>
                  </div>
                </div>

                {/* Danger zone */}
                <div style={{ background: 'rgba(255,51,102,0.04)', border: '1px solid rgba(255,51,102,0.2)', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: '#FF3366', letterSpacing: 2, marginBottom: 6 }}>⚠️ DANGER ZONE</div>
                  <p style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,51,102,0.5)', marginBottom: 14, lineHeight: 1.7 }}>Permanently deletes ALL data. Cannot be undone.</p>
                  {!showNuke ? (
                    <button onClick={() => setShowNuke(true)} style={{ padding: '9px 20px', background: 'transparent', border: '2px solid rgba(255,51,102,0.4)', borderRadius: 8, color: '#FF3366', fontFamily: 'Syne', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>🗑 Delete All Data</button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="password" value={nukePw} onChange={e => setNukePw(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleClearAll()} placeholder="Password" autoFocus style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: `2px solid ${nukeErr ? '#FF3366' : 'rgba(255,51,102,0.3)'}`, borderRadius: 8, color: '#FF3366', fontFamily: 'Space Mono', fontSize: 10, width: 180, outline: 'none' }} />
                      <button onClick={handleClearAll} style={{ padding: '9px 16px', background: '#FF3366', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'Syne', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Confirm</button>
                      <button onClick={() => { setShowNuke(false); setNukePw(''); setNukeErr('') }} style={{ padding: '9px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.3)', fontFamily: 'Space Mono', fontSize: 9, cursor: 'pointer' }}>Cancel</button>
                      {nukeErr && <span style={{ fontFamily: 'Space Mono', fontSize: 9, color: '#FF3366' }}>{nukeErr}</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div key={toast} style={{ animation: 'fxToast .45s cubic-bezier(.34,1.56,.64,1) both', position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', background: 'rgba(2,6,16,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 11, color: '#00D4FF', boxShadow: '0 0 30px rgba(0,212,255,0.15)', zIndex: 9999 }}>{toast}</div>
      )}
    </div>
  )
}

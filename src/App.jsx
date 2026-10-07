import React, { useState, useEffect } from 'react'
import { supabase, supabaseReady } from './lib/supabase'
import Auth from './Auth.jsx'
import AdminPanel from './AdminPanel.jsx'
import Dashboard from './Dashboard.jsx'

const Setup = () => (
  <div style={{ minHeight: '100vh', background: '#020610', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div style={{ maxWidth: 500, background: '#0a1628', border: '1px solid rgba(255,184,0,0.3)', borderRadius: 16, padding: 36, textAlign: 'center' }}>
      <div style={{ fontSize: 38, marginBottom: 14 }}>⚙️</div>
      <div style={{ fontFamily: 'Space Mono', fontSize: 16, fontWeight: 700, color: '#FFB800', letterSpacing: 2, marginBottom: 12 }}>SETUP REQUIRED</div>
      <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, marginBottom: 18 }}>
        Set <span style={{ color: '#FFB800' }}>VITE_SUPABASE_URL</span> and <span style={{ color: '#FFB800' }}>VITE_SUPABASE_ANON_KEY</span> in Vercel → Settings → Environment Variables → Redeploy.
      </p>
    </div>
  </div>
)

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard')

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    setProfile(data)
    setLoading(false)
  }

  if (!supabaseReady) return <Setup />

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#020610', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#00D4FF', letterSpacing: 3 }}>LOADING EDITH…</div>
    </div>
  )

  if (!session) return <Auth />

  if (profile?.is_blocked) return (
    <div style={{ minHeight: '100vh', background: '#020610', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 36, color: '#FF3366' }}>⛔</div>
      <div style={{ fontFamily: 'Space Mono', fontSize: 13, color: '#FF3366', letterSpacing: 2 }}>ACCOUNT SUSPENDED</div>
      <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Contact your administrator.</div>
      <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 8, padding: '9px 22px', background: 'transparent', border: '1px solid rgba(255,51,102,0.3)', borderRadius: 8, color: '#FF3366', fontFamily: 'Space Mono', fontSize: 10, cursor: 'pointer' }}>Sign Out</button>
    </div>
  )

  if (view === 'admin' && profile?.role === 'admin') {
    return <AdminPanel onBack={() => setView('dashboard')} />
  }

  return (
    <Dashboard
      user={session.user}
      profile={profile}
      onSignOut={() => supabase.auth.signOut()}
      onAdmin={profile?.role === 'admin' ? () => setView('admin') : null}
    />
  )
}

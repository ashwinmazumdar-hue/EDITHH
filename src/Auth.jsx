import React, { useState } from 'react'
import { supabase } from './lib/supabase'
import { StarField, CursorFX, AnimatedLogo } from './fx.jsx'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async () => {
    if (!email || !password) { setError('Email and password required'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          if (/not confirmed/i.test(error.message)) throw new Error('This email is not confirmed yet. Ask your admin to run the setup SQL again, which confirms all pending users.')
          if (/invalid login/i.test(error.message)) throw new Error('Wrong email or password.')
          throw error
        }
        // Check blocked
        const { data: profile } = await supabase.from('profiles').select('is_blocked').eq('id', data.user.id).maybeSingle()
        if (profile?.is_blocked) {
          await supabase.auth.signOut()
          throw new Error('Your account has been suspended. Contact your administrator.')
        }
      } else {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.')
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // With email confirmation switched off in Supabase, a session comes back
        // straight away and the user is signed in with no code needed.
        if (!data.session) {
          setSuccess('Account created. Switch to Login and sign in.')
          setMode('login')
        }
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div style={{ position: 'relative',
      minHeight: '100vh', background: '#020610',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px)',
      backgroundSize: '40px 40px',
    }}>
      <StarField density={1.2} />
      <CursorFX />
      <div className="fx-rise fx-border" style={{ '--c': '#00D4FF', position: 'relative', zIndex: 2, backdropFilter: 'blur(18px)',
        width: 400, background: 'linear-gradient(135deg,#0a1628,#040b14)',
        border: '1px solid rgba(0,212,255,0.15)', borderRadius: 16,
        padding: '44px 36px', boxShadow: '0 0 60px rgba(0,212,255,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <AnimatedLogo size={30} spacing={7} />
          <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 3, marginTop: 4 }}>CAMPAIGN INTELLIGENCE</div>
        </div>

        <div style={{ display: 'flex', background: '#060f1e', borderRadius: 8, padding: 3, marginBottom: 24, border: '1px solid rgba(0,212,255,0.1)' }}>
          {['login', 'signup'].map(m => (
            <button key={m} className="fx-btn" onClick={() => { setMode(m); setError(''); setSuccess('') }} style={{ transition: 'all .3s',
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', borderRadius: 6,
              background: mode === m ? 'rgba(0,212,255,0.12)' : 'transparent',
              color: mode === m ? '#00D4FF' : 'rgba(255,255,255,0.3)',
              fontFamily: 'Space Mono', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            }}>{m}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, display: 'block', marginBottom: 5 }}>EMAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="you@company.com"
              style={{ width: '100%', padding: '10px 14px', background: '#060f1e', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, color: '#e2e8f0', fontFamily: 'Space Mono', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, display: 'block', marginBottom: 5 }}>PASSWORD</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px 14px', background: '#060f1e', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, color: '#e2e8f0', fontFamily: 'Space Mono', fontSize: 12 }} />
          </div>
        </div>

        {error && <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.3)', borderRadius: 8, fontFamily: 'Space Mono', fontSize: 10, color: '#FF3366' }}>{error}</div>}
        {success && <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 8, fontFamily: 'Space Mono', fontSize: 10, color: '#00FF88' }}>{success}</div>}

        <button className="fx-btn fx-shine" onClick={submit} disabled={loading} style={{ '--c': '#00D4FF',
          width: '100%', marginTop: 22, padding: '13px 0',
          background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#00D4FF,#0099BB)',
          border: 'none', borderRadius: 8, color: '#020610',
          fontFamily: 'Syne', fontWeight: 800, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 1,
        }}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <p style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 20 }}>
          Access managed by your administrator.
        </p>
      </div>
    </div>
  )
}

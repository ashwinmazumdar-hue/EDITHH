import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Shield, Users, RefreshCw, Ban, CheckCircle, Crown, ArrowLeft } from 'lucide-react'

export default function AdminPanel({ onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleBlock = async (u) => {
    const { error } = await supabase.from('profiles').update({ is_blocked: !u.is_blocked }).eq('id', u.id)
    if (!error) { showToast(`${u.email} ${!u.is_blocked ? 'blocked' : 'unblocked'}`); load() }
    else showToast(error.message)
  }

  const toggleAdmin = async (u) => {
    const role = u.role === 'admin' ? 'user' : 'admin'
    const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
    if (!error) { showToast(`${u.email} is now ${role}`); load() }
    else showToast(error.message)
  }

  const stats = {
    total: users.length,
    active: users.filter(u => !u.is_blocked).length,
    blocked: users.filter(u => u.is_blocked).length,
    admins: users.filter(u => u.role === 'admin').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020610', padding: 32,
      backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px)',
      backgroundSize: '40px 40px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={13} /> Back
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color="#00D4FF" />
            <h1 style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: 16, color: '#00D4FF', letterSpacing: 2 }}>ADMIN PANEL</h1>
          </div>
          <p style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>User management & access control</p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={load} style={{ background: 'none', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8, padding: '8px 14px', color: '#00D4FF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Space Mono', fontSize: 10 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          ['Total Users', stats.total, '#00D4FF'],
          ['Active', stats.active, '#00FF88'],
          ['Blocked', stats.blocked, '#FF3366'],
          ['Admins', stats.admins, '#FFB800'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${c}22`, borderRadius: 12, padding: '18px 22px' }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 6 }}>{l.toUpperCase()}</div>
            <div style={{ fontFamily: 'Space Mono', fontSize: 24, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color="#00D4FF" />
          <span style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: 11, color: '#00D4FF', letterSpacing: 1 }}>ALL USERS</span>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Space Mono', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#060f1e' }}>
                {['Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(0,212,255,0.05)' }}>
                  <td style={{ padding: '14px 18px', fontFamily: 'Space Mono', fontSize: 11, color: '#e2e8f0' }}>{u.email}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 8, letterSpacing: 1, padding: '3px 10px', borderRadius: 20, color: u.role === 'admin' ? '#FFB800' : 'rgba(255,255,255,0.4)', background: u.role === 'admin' ? 'rgba(255,184,0,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${u.role === 'admin' ? 'rgba(255,184,0,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                      {u.role === 'admin' ? '👑 ADMIN' : 'USER'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 8, letterSpacing: 1, padding: '3px 10px', borderRadius: 20, color: u.is_blocked ? '#FF3366' : '#00FF88', background: u.is_blocked ? 'rgba(255,51,102,0.1)' : 'rgba(0,255,136,0.1)', border: `1px solid ${u.is_blocked ? 'rgba(255,51,102,0.3)' : 'rgba(0,255,136,0.3)'}` }}>
                      {u.is_blocked ? '⛔ BLOCKED' : '● ACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'Space Mono', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => toggleBlock(u)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'transparent', border: `1px solid ${u.is_blocked ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`, borderRadius: 6, cursor: 'pointer', color: u.is_blocked ? '#00FF88' : '#FF3366', fontFamily: 'Space Mono', fontSize: 8 }}>
                        {u.is_blocked ? <><CheckCircle size={10} /> Unblock</> : <><Ban size={10} /> Block</>}
                      </button>
                      <button onClick={() => toggleAdmin(u)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'transparent', border: `1px solid ${u.role === 'admin' ? 'rgba(255,255,255,0.15)' : 'rgba(255,184,0,0.3)'}`, borderRadius: 6, cursor: 'pointer', color: u.role === 'admin' ? 'rgba(255,255,255,0.4)' : '#FFB800', fontFamily: 'Space Mono', fontSize: 8 }}>
                        <Crown size={10} /> {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', background: 'rgba(2,6,16,0.95)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 11, color: '#00D4FF', boxShadow: '0 0 30px rgba(0,212,255,0.15)' }}>{toast}</div>
      )}
    </div>
  )
}

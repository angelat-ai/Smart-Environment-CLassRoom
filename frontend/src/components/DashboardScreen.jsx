import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement } from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  fetchRooms, simulateMotion, simulateLightsOff, fetchRoomHistory,
  createRoom, deleteRoom as apiDeleteRoom,
  fetchAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule
} from '../api'
import PlexusLoader from './PlexusLoader'
import Classroom3DPage from './Classroom3DPage'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement)

const POLL_INTERVAL = 2000
const ZAMCELCO_RATE = 13.25
const WMSU_LOGO = 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/WMSU_logo.png/200px-WMSU_logo.png'

const CLASS_PERIODS = [
  { key: 'all',       label: 'All Periods',     start: 0,  end: 24 },
  { key: 'morning',   label: 'Morning Class',   start: 6,  end: 12 },
  { key: 'noon',      label: 'Noon / Midday',   start: 11, end: 14 },
  { key: 'afternoon', label: 'Afternoon Class', start: 12, end: 17 },
  { key: 'evening',   label: 'Evening Class',   start: 17, end: 21 },
  { key: 'after',     label: 'After Hours',     start: 21, end: 24 },
]

const PERIOD_COLORS = {
  morning: '#f59e0b', noon: '#6366f1', afternoon: '#10b981', evening: '#8b5cf6', after: '#64748b', all: '#00c896'
}

function getEventPeriodKey(timestamp) {
  const h = new Date(timestamp).getHours()
  if (h >= 6  && h < 12) return 'morning'
  if (h >= 11 && h < 14) return 'noon'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  if (h >= 21)            return 'after'
  return 'morning'
}

function StatusBadge({ on }) {
  return <span className={`stat-pill ${on ? 'pill-on' : 'pill-off'}`}>{on ? 'Active' : 'Inactive'}</span>
}

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} className={`toast toast-${t.type}`}
            initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}>
            <span className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'warning' ? '⚠' : 'ℹ'}</span>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function ModalWrap({ title, children, onClose }) {
  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-content" initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.4rem', color: 'var(--text-1)', fontWeight: 400 }}>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </motion.div>
    </motion.div>
  )
}

function NotificationBell({ notifications, onNavigate, onDelete, onClearAll, onMarkAllRead }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(o => !o); if (!open) onMarkAllRead() }}
        style={{ position: 'relative', background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: open ? 'var(--green)' : 'var(--text-2)', display: 'flex', alignItems: 'center', transition: 'all 0.18s', borderColor: open ? 'var(--green)' : 'var(--border)' }}
        title="Notifications">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <motion.span key={unread} initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: 'white', fontSize: '0.6rem', fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
            style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.13)', zIndex: 500, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-1)' }}>
                Notifications
                {unread > 0 && <span style={{ marginLeft: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>{unread} new</span>}
              </span>
              {notifications.length > 0 && <button onClick={onClearAll} style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Clear all</button>}
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: '0.85rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔔</div>No notifications yet
                </div>
              ) : notifications.map(n => (
                <motion.div key={n.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'rgba(0,200,150,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => { onNavigate(n); setOpen(false) }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(0,200,150,0.04)'}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: n.type === 'motion' ? 'rgba(0,200,150,0.12)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                    {n.type === 'motion' ? '💡' : '🌑'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.81rem', fontWeight: n.read ? 400 : 600, color: 'var(--text-1)', marginBottom: 1 }}>{n.title}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-3)', lineHeight: 1.4 }}>{n.body}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 2 }}>{n.timeLabel}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onDelete(n.id) }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, fontSize: '0.82rem', alignSelf: 'flex-start', flexShrink: 0 }}>✕</button>
                </motion.div>
              ))}
            </div>
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Click to jump to Event Logs</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RoleBadge({ role }) {
  const cfg = {
    admin:     { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444',  label: 'Admin' },
    professor: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', label: 'Professor' },
    viewer:    { bg: 'rgba(0,200,150,0.1)',   color: '#00c896',  label: 'Viewer' },
  }
  const c = cfg[role] || cfg.viewer
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: c.bg, color: c.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</span>
  )
}

function EventLogsPage({ rooms, setActiveNav }) {
  const [periodFilter, setPeriodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roomFilter, setRoomFilter]     = useState('all')
  const [search, setSearch]             = useState('')

  const allEvents = React.useMemo(() => {
    const src = roomFilter === 'all' ? rooms : rooms.filter(r => r.name === roomFilter)
    const evs = []
    src.forEach(room => (room.events || []).forEach(ev => evs.push({ ...ev, roomName: room.name })))
    return evs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [rooms, roomFilter])

  const filtered = React.useMemo(() => {
    const period = CLASS_PERIODS.find(p => p.key === periodFilter)
    return allEvents.filter(ev => {
      const h   = new Date(ev.timestamp).getHours()
      const ok1 = periodFilter === 'all' || (h >= period.start && h < period.end)
      const ok2 = statusFilter === 'all' || ev.status === statusFilter
      const ok3 = !search || ev.event_type?.toLowerCase().includes(search.toLowerCase()) || ev.roomName?.toLowerCase().includes(search.toLowerCase())
      return ok1 && ok2 && ok3
    })
  }, [allEvents, periodFilter, statusFilter, search])

  const periodStats = React.useMemo(() =>
    CLASS_PERIODS.filter(p => p.key !== 'all').map(p => ({
      ...p,
      count: allEvents.filter(ev => {
        const h = new Date(ev.timestamp).getHours()
        return h >= p.start && h < p.end
      }).length
    }))
  , [allEvents])

  const exportCSV = () => {
    const rows = [['Date', 'Time', 'Period', 'Event', 'Room', 'Duration', 'Status']]
    filtered.forEach(ev => {
      const d   = new Date(ev.timestamp)
      const per = CLASS_PERIODS.find(p => p.key === getEventPeriodKey(ev.timestamp))
      rows.push([d.toLocaleDateString(), d.toLocaleTimeString(), per?.label || '—', ev.event_type, `Room ${ev.roomName}`, ev.duration || '—', ev.status === 'on' ? 'Active' : 'Ended'])
    })
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'sec-event-logs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Event Logs</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>{filtered.length} events · Live monitoring</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'livePulse 1.8s infinite' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600 }}>Live</span>
          </div>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--dark)', color: 'var(--green)', border: '1.5px solid rgba(0,200,150,0.3)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
        {periodStats.map(p => (
          <button key={p.key} onClick={() => setPeriodFilter(p.key)} style={{ padding: '12px 8px', borderRadius: 10, border: `1.5px solid ${periodFilter === p.key ? PERIOD_COLORS[p.key] : 'var(--border)'}`, background: periodFilter === p.key ? `${PERIOD_COLORS[p.key]}12` : 'var(--surface)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
            <div style={{ fontSize: '1.3rem', fontFamily: "'Instrument Serif', serif", color: periodFilter === p.key ? PERIOD_COLORS[p.key] : 'var(--text-1)', marginBottom: 3 }}>{p.count}</div>
            <div style={{ fontSize: '0.68rem', color: periodFilter === p.key ? PERIOD_COLORS[p.key] : 'var(--text-3)', fontWeight: 500 }}>{p.label}</div>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…"
            style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', color: 'var(--text-1)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)}
          style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', color: 'var(--text-1)', background: 'var(--surface)', outline: 'none', cursor: 'pointer' }}>
          <option value="all">All Rooms</option>
          {rooms.map(r => <option key={r.id} value={r.name}>Room {r.name}</option>)}
        </select>
        <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
          style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', color: 'var(--text-1)', background: 'var(--surface)', outline: 'none', cursor: 'pointer' }}>
          {CLASS_PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ v: 'all', l: 'All' }, { v: 'on', l: 'Active' }, { v: 'off', l: 'Ended' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)} style={{ padding: '7px 12px', borderRadius: 7, border: `1.5px solid ${statusFilter === s.v ? 'var(--green)' : 'var(--border)'}`, background: statusFilter === s.v ? 'rgba(0,200,150,0.08)' : 'var(--surface)', color: statusFilter === s.v ? 'var(--green)' : 'var(--text-3)', fontFamily: 'Geist, sans-serif', fontSize: '0.77rem', fontWeight: 500, cursor: 'pointer' }}>{s.l}</button>
          ))}
        </div>
        {(periodFilter !== 'all' || statusFilter !== 'all' || roomFilter !== 'all' || search) && (
          <button onClick={() => { setPeriodFilter('all'); setStatusFilter('all'); setRoomFilter('all'); setSearch('') }}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', fontFamily: 'Geist, sans-serif', fontSize: '0.77rem', cursor: 'pointer' }}>✕ Clear</button>
        )}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.845rem', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Time', 'Period', 'Event', 'Room', 'Duration', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontSize: '0.85rem' }}>No events match the current filters</td></tr>
                : filtered.map((ev, i) => {
                  const pk = getEventPeriodKey(ev.timestamp)
                  const pc = PERIOD_COLORS[pk] || '#888'
                  const pl = CLASS_PERIODS.find(p => p.key === pk)?.label || '—'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f7f5', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 14px', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{new Date(ev.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: `${pc}18`, color: pc }}>{pl}</span>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--text-1)', fontWeight: 500 }}>{ev.event_type}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--text-2)' }}>Room {ev.roomName}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--text-3)', fontFamily: 'monospace', fontSize: '0.79rem' }}>{ev.duration || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 600, background: ev.status === 'on' ? '#d1fae5' : '#fef3c7', color: ev.status === 'on' ? '#065f46' : '#92400e' }}>
                          {ev.status === 'on' ? 'Active' : 'Ended'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

function RoomsPage({ rooms, setRooms, setSelectedRoom, setActiveNav, addToast, demoMode, userRole }) {
  const [adding, setAdding]             = useState(false)
  const [newName, setNewName]           = useState('')
  const [newDesc, setNewDesc]           = useState('')
  const [saving, setSaving]             = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget]     = useState(null)
  const [editDesc, setEditDesc]         = useState('')
  const isAdmin = userRole === 'admin'

  const handleAdd = async () => {
    const name = newName.trim().toUpperCase().slice(0, 3)
    if (!name) return
    if (rooms.find(r => r.name === name)) { addToast(`Room ${name} already exists`, 'warning'); return }
    setSaving(true)
    try {
      if (demoMode) {
        const today = new Date()
        const newRoom = {
          id: Date.now(), name, description: newDesc,
          is_active: false, occupancy: false, energy_saved_today: 0,
          last_motion: null, events: [],
          energy_logs: Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today); d.setDate(d.getDate() - (6 - i))
            return { date: d.toISOString().slice(0, 10), hours_on: 0, energy_saved: 0 }
          })
        }
        setRooms(prev => [...prev, newRoom])
      } else {
        const newRoom = await createRoom(name, newDesc)
        setRooms(prev => [...prev, newRoom])
      }
      addToast(`Room ${name} added successfully`, 'success')
      setNewName(''); setNewDesc(''); setAdding(false)
    } catch { addToast('Failed to add room', 'warning') }
    finally { setSaving(false) }
  }

  const handleDelete = async (room) => {
    try {
      if (!demoMode) await apiDeleteRoom(room.id)
      setRooms(prev => prev.filter(r => r.id !== room.id))
      addToast(`Room ${room.name} removed`, 'info')
    } catch { addToast('Failed to remove room', 'warning') }
    setDeleteTarget(null)
  }

  const handleEditSave = (room) => {
    setRooms(prev => prev.map(r => r.id === room.id ? { ...r, description: editDesc } : r))
    addToast(`Room ${room.name} updated`, 'success')
    setEditTarget(null)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Rooms</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>{rooms.length} room{rooms.length !== 1 ? 's' : ''} monitored</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAdding(!adding)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: adding ? 'var(--bg)' : 'var(--dark)', color: adding ? 'var(--text-2)' : 'var(--green)', border: `1.5px solid ${adding ? 'var(--border)' : 'rgba(0,200,150,0.3)'}`, borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', fontWeight: 500, cursor: 'pointer' }}>
            {adding ? '✕ Cancel' : '+ Add Room'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {adding && isAdmin && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ background: 'var(--surface)', border: '1.5px solid var(--green)', borderRadius: 12, padding: 22, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 14 }}>New Room</div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Label *</label>
                <input value={newName} onChange={e => setNewName(e.target.value.toUpperCase().slice(0, 3))} placeholder="e.g. D"
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Description (optional)</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. CCS Lab 3 — 3rd Floor"
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handleAdd} disabled={saving || !newName.trim()} style={{ padding: '9px 18px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', fontWeight: 500, cursor: saving || !newName.trim() ? 'not-allowed' : 'pointer', opacity: saving || !newName.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {saving ? 'Saving…' : 'Add Room'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rooms-grid">
        {rooms.map(room => (
          <motion.div key={room.id} layout
            style={{ background: 'var(--surface)', border: `1.5px solid ${room.is_active ? 'rgba(0,200,150,0.35)' : 'var(--border)'}`, borderRadius: 14, padding: 22, cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.2s' }}
            onClick={() => { setSelectedRoom(room.name); setActiveNav('dashboard') }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            {room.is_active && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--green)', borderRadius: '3px 0 0 3px' }} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', lineHeight: 1 }}>Room {room.name}</div>
                {room.description && <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 3 }}>{room.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <StatusBadge on={room.is_active} />
                {isAdmin && (
                  <button onClick={e => { e.stopPropagation(); setEditTarget(room); setEditDesc(room.description || '') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '3px 5px', borderRadius: 5, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--green)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
                {isAdmin && rooms.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget(room) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '3px 5px', borderRadius: 5, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                )}
              </div>
            </div>
            {[['Occupancy', room.occupancy ? '🟢 Occupied' : '⚪ Vacant'], ['Energy saved', `${(room.energy_saved_today || 0).toFixed(3)} kWh`], ['Peso savings', `₱${((room.energy_saved_today || 0) * ZAMCELCO_RATE).toFixed(2)}`], ['Events today', (room.events || []).length]].map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.79rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-3)' }}>{l}</span>
                <strong style={{ color: 'var(--text-1)' }}>{v}</strong>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-3)' }}>
              Last motion: {room.last_motion ? new Date(room.last_motion).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Never'}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {editTarget && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditTarget(null)}>
            <motion.div className="modal-content" style={{ maxWidth: 420 }} initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.2rem', color: 'var(--text-1)', fontWeight: 400 }}>Edit Room {editTarget.name}</h3>
                <button className="modal-close" onClick={() => setEditTarget(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Room Label</label>
                  <input value={editTarget.name} disabled style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-3)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box', opacity: 0.6 }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Description</label>
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="e.g. CCS Lab 1 — Ground Floor"
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setEditTarget(null)} style={{ flex: 1, padding: '9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleEditSave(editTarget)} style={{ flex: 1, padding: '9px', background: 'var(--green)', border: 'none', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Save Changes</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTarget(null)}>
            <motion.div className="modal-content" style={{ maxWidth: 380 }} initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.2rem', color: 'var(--text-1)', fontWeight: 400 }}>Remove Room {deleteTarget.name}?</h3>
                <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 18 }}>This will remove Room {deleteTarget.name} from the dashboard. All associated event logs and energy data will be deleted from the server.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleDelete(deleteTarget)} style={{ flex: 1, padding: '9px', background: '#ef4444', border: 'none', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Delete Room</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function TimelinePage({ rooms, selectedRoom }) {
  const [playing, setPlaying]           = useState(false)
  const [progress, setProgress]         = useState(0)
  const [speed, setSpeed]               = useState(1)
  const [currentEvent, setCurrentEvent] = useState(null)
  const [filterRoom, setFilterRoom]     = useState(selectedRoom)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const intervalRef = useRef(null)

  const room = rooms.find(r => r.name === filterRoom) || rooms[0]
  const allEvents = React.useMemo(() => {
    const evs = (room?.events || []).slice().reverse()
    if (filterPeriod === 'all') return evs
    const p = CLASS_PERIODS.find(x => x.key === filterPeriod)
    return evs.filter(ev => { const h = new Date(ev.timestamp).getHours(); return h >= p.start && h < p.end })
  }, [room, filterPeriod])

  const idx     = Math.floor((progress / 100) * Math.max(allEvents.length - 1, 0))
  const visible = allEvents.slice(0, idx + 1)
  const active  = allEvents[idx]

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setProgress(p => { if (p >= 100) { setPlaying(false); return 100 } return Math.min(p + 0.5 * speed, 100) })
      }, 100)
    } else clearInterval(intervalRef.current)
    return () => clearInterval(intervalRef.current)
  }, [playing, speed])

  useEffect(() => { if (active) setCurrentEvent(active) }, [idx])

  const reset = () => { setProgress(0); setPlaying(false); setCurrentEvent(null) }
  const lightsOn = active?.status === 'on'

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Timeline Playback</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Replay events and watch the room respond in real time</p>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterRoom} onChange={e => { setFilterRoom(e.target.value); reset() }}
          style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', color: 'var(--text-1)', background: 'var(--surface)', outline: 'none', cursor: 'pointer' }}>
          {rooms.map(r => <option key={r.id} value={r.name}>Room {r.name}</option>)}
        </select>
        <select value={filterPeriod} onChange={e => { setFilterPeriod(e.target.value); reset() }}
          style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', color: 'var(--text-1)', background: 'var(--surface)', outline: 'none', cursor: 'pointer' }}>
          {CLASS_PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <span style={{ fontSize: '0.79rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>{allEvents.length} events in selection</span>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <input type="range" min={0} max={100} value={progress} onChange={e => { setProgress(Number(e.target.value)); setPlaying(false) }}
          style={{ width: '100%', accentColor: 'var(--green)', cursor: 'pointer', marginBottom: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-3)', marginBottom: 18 }}>
          <span>{allEvents[0] ? new Date(allEvents[0].timestamp).toLocaleTimeString() : '—'}</span>
          <span style={{ color: 'var(--green)', fontWeight: 500 }}>{Math.round(progress)}% through</span>
          <span>{allEvents[allEvents.length - 1] ? new Date(allEvents[allEvents.length - 1].timestamp).toLocaleTimeString() : '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setPlaying(!playing)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: playing ? 'var(--bg)' : 'var(--green)', color: playing ? 'var(--text-1)' : 'white', border: '1.5px solid var(--border)', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.86rem', fontWeight: 500, cursor: 'pointer' }}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={reset} style={{ padding: '9px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.86rem', color: 'var(--text-2)', cursor: 'pointer' }}>↺ Reset</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.77rem', color: 'var(--text-3)' }}>Speed:</span>
            {[0.5, 1, 2, 4].map(s => (
              <button key={s} onClick={() => setSpeed(s)} style={{ padding: '5px 9px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 600, border: `1px solid ${speed === s ? 'var(--green)' : 'var(--border)'}`, background: speed === s ? 'var(--green-dim)' : 'var(--bg)', color: speed === s ? 'var(--green)' : 'var(--text-3)', cursor: 'pointer' }}>{s}×</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: lightsOn ? 'rgba(0,200,150,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${lightsOn ? 'rgba(0,200,150,0.3)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: lightsOn ? 'var(--green)' : 'var(--red)', display: 'inline-block', animation: lightsOn ? 'livePulse 1.8s infinite' : 'none' }} />
            <span style={{ fontSize: '0.79rem', fontWeight: 600, color: lightsOn ? 'var(--green)' : 'var(--red)' }}>Room {filterRoom} — Lights {lightsOn ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      </div>
      {currentEvent && (
        <motion.div key={currentEvent.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          style={{ background: currentEvent.status === 'on' ? 'rgba(0,200,150,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${currentEvent.status === 'on' ? 'rgba(0,200,150,0.25)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: currentEvent.status === 'on' ? 'var(--green-dim)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
            {currentEvent.status === 'on' ? '💡' : '🌑'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>{currentEvent.event_type}</div>
            <div style={{ fontSize: '0.77rem', color: 'var(--text-3)', marginTop: 2 }}>{new Date(currentEvent.timestamp).toLocaleString()} · {CLASS_PERIODS.find(p => p.key === getEventPeriodKey(currentEvent.timestamp))?.label}</div>
          </div>
        </motion.div>
      )}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--text-1)', marginBottom: 14 }}>Event Timeline</div>
        {allEvents.length === 0
          ? <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.84rem', padding: 24 }}>No events to replay.</div>
          : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 18, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {visible.slice(-14).map((ev, i) => {
                  const isAct = ev === active
                  const pk = getEventPeriodKey(ev.timestamp)
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0 8px 8px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${ev.status === 'on' ? 'var(--green)' : 'var(--red)'}`, background: isAct ? (ev.status === 'on' ? 'var(--green)' : 'var(--red)') : 'white', flexShrink: 0, zIndex: 1 }} />
                      <div style={{ fontSize: '0.77rem', color: 'var(--text-3)', width: 68, flexShrink: 0 }}>{new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: `${PERIOD_COLORS[pk] || '#888'}18`, color: PERIOD_COLORS[pk] || '#888', flexShrink: 0 }}>
                        {CLASS_PERIODS.find(p => p.key === pk)?.label?.split(' ')[0]}
                      </span>
                      <div style={{ fontSize: '0.81rem', color: isAct ? 'var(--text-1)' : 'var(--text-2)', fontWeight: isAct ? 600 : 400 }}>{ev.event_type}</div>
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: ev.status === 'on' ? '#d1fae5' : '#fee2e2', color: ev.status === 'on' ? '#065f46' : '#991b1b' }}>
                        {ev.status === 'on' ? 'Active' : 'Ended'}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        }
      </div>
    </motion.div>
  )
}

function AutomationPage({ rooms, addToast, demoMode, userRole }) {
  const [rules, setRules]       = useState([])
  const [adding, setAdding]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [editRule, setEditRule] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [form, setForm]         = useState({ name: '', trigger: 'no_motion', delay: 5, action: 'lights_off', room: rooms[0]?.name || 'A', enabled: true })
  const canManage = userRole === 'admin' || userRole === 'professor'

  const TRIGGER_LABELS = { no_motion: 'No motion detected', motion: 'Motion detected', lights_on: 'Lights turn ON', lights_off: 'Lights turn OFF', time_of_day: 'Time of day' }
  const ACTION_LABELS  = { lights_off: 'Turn lights OFF', lights_on: 'Turn lights ON', notify: 'Send notification', log_event: 'Log event' }

  useEffect(() => {
    if (demoMode) {
      const saved = JSON.parse(localStorage.getItem('sec_rules') || '[]')
      if (saved.length === 0 && rooms.length > 0) {
        const defaults = rooms.map(r => ({
          id: Date.now() + Math.random(), name: `Auto lights off — Room ${r.name}`,
          room: r.name, room_name: r.name, trigger: 'no_motion', action: 'lights_off', delay_minutes: 5, enabled: true
        }))
        setRules(defaults)
        localStorage.setItem('sec_rules', JSON.stringify(defaults))
      } else setRules(saved)
      setLoading(false)
    } else {
      fetchAutomationRules().then(data => { setRules(data); setLoading(false) }).catch(() => setLoading(false))
    }
  }, [demoMode, rooms])

  const saveLocal = (updated) => { setRules(updated); if (demoMode) localStorage.setItem('sec_rules', JSON.stringify(updated)) }

  const addRule = async () => {
    if (!form.name.trim()) return
    try {
      if (demoMode) {
        const r = { ...form, id: Date.now(), room_name: form.room, delay_minutes: form.delay, created_at: new Date().toISOString() }
        saveLocal([...rules, r])
      } else {
        const r = await createAutomationRule({ name: form.name, room: form.room, trigger: form.trigger, action: form.action, delay_minutes: form.delay })
        setRules(prev => [...prev, r])
      }
      setForm({ name: '', trigger: 'no_motion', delay: 5, action: 'lights_off', room: rooms[0]?.name || 'A', enabled: true })
      setAdding(false)
      addToast('Automation rule created!', 'success')
    } catch { addToast('Failed to create rule', 'warning') }
  }

  const toggleRule = async (rule) => {
    const updated = { ...rule, enabled: !rule.enabled }
    if (!demoMode) await updateAutomationRule(rule.id, { enabled: updated.enabled })
    saveLocal(rules.map(r => r.id === rule.id ? updated : r))
  }

  const removeRule = async (rule) => {
    if (!demoMode) { try { await deleteAutomationRule(rule.id) } catch {} }
    saveLocal(rules.filter(r => r.id !== rule.id))
    addToast('Rule deleted', 'info')
  }

  const openEdit = (rule) => {
    setEditRule(rule)
    setEditForm({ name: rule.name, trigger: rule.trigger, action: rule.action, delay: rule.delay_minutes || rule.delay || 5, room: rule.room_name || rule.room, enabled: rule.enabled })
  }

  const saveEdit = async () => {
    const updated = { ...editRule, name: editForm.name, trigger: editForm.trigger, action: editForm.action, delay_minutes: editForm.delay, room: editForm.room, room_name: editForm.room, enabled: editForm.enabled }
    if (!demoMode) { try { await updateAutomationRule(editRule.id, { name: editForm.name, trigger: editForm.trigger, action: editForm.action, delay_minutes: editForm.delay, room: editForm.room }) } catch {} }
    saveLocal(rules.map(r => r.id === editRule.id ? updated : r))
    addToast('Rule updated', 'success')
    setEditRule(null)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Automation Rules</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Smart triggers synced to all rooms · {rules.filter(r => r.enabled).length} active</p>
        </div>
        {canManage && (
          <button onClick={() => setAdding(!adding)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: adding ? 'var(--bg)' : 'var(--dark)', color: adding ? 'var(--text-2)' : 'var(--green)', border: `1.5px solid ${adding ? 'var(--border)' : 'rgba(0,200,150,0.3)'}`, borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', fontWeight: 500, cursor: 'pointer' }}>
            {adding ? '✕ Cancel' : '+ Add Rule'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {adding && canManage && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ background: 'var(--surface)', border: '1.5px solid var(--green)', borderRadius: 12, padding: 22, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 14 }}>New Rule</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Rule Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Auto lights off after class"
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Room</label>
                <select value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>
                  {rooms.map(r => <option key={r.id} value={r.name}>Room {r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Trigger (IF)</label>
                <select value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>
                  {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Action (THEN)</label>
                <select value={form.action} onChange={e => setForm(p => ({ ...p, action: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>
                  {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Delay (minutes)</label>
                <input type="number" min={1} max={60} value={form.delay} onChange={e => setForm(p => ({ ...p, delay: parseInt(e.target.value) || 5 }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={addRule} style={{ width: '100%', padding: '9px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.86rem', fontWeight: 500, cursor: 'pointer' }}>Save Rule</button>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: '9px 12px', background: 'rgba(0,200,150,0.06)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-2)' }}>
              <strong style={{ color: 'var(--text-1)' }}>Preview: </strong>IF <strong>{TRIGGER_LABELS[form.trigger]}</strong> for <strong>{form.delay}min</strong> in <strong>Room {form.room}</strong> → THEN <strong>{ACTION_LABELS[form.action]}</strong>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading rules…</div>
      ) : rules.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>⚙️</div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)', marginBottom: 6 }}>No Rules Yet</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-3)', lineHeight: 1.7 }}>Create automation rules to control lights based on motion, time, or occupancy.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map((rule, i) => (
            <motion.div key={rule.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              style={{ background: 'var(--surface)', border: `1.5px solid ${rule.enabled ? 'rgba(0,200,150,0.2)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: rule.enabled ? 1 : 0.55 }}>
              {canManage && (
                <div onClick={() => toggleRule(rule)} style={{ width: 38, height: 22, borderRadius: 11, cursor: 'pointer', flexShrink: 0, background: rule.enabled ? 'var(--green)' : 'var(--border)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: rule.enabled ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-1)', marginBottom: 3 }}>{rule.name}</div>
                <div style={{ fontSize: '0.79rem', color: 'var(--text-3)' }}>
                  IF <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{TRIGGER_LABELS[rule.trigger]}</span> for {rule.delay_minutes || rule.delay}min in Room <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{rule.room_name || rule.room}</span>
                  {' → '}<span style={{ color: 'var(--green)', fontWeight: 500 }}>{ACTION_LABELS[rule.action]}</span>
                </div>
              </div>
              <span style={{ fontSize: '0.69rem', fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: rule.enabled ? 'rgba(0,200,150,0.1)' : 'rgba(0,0,0,0.05)', color: rule.enabled ? 'var(--green)' : 'var(--text-3)' }}>
                {rule.enabled ? 'Active' : 'Paused'}
              </span>
              {canManage && (
                <>
                  <button onClick={() => openEdit(rule)}
                    style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-3)', padding: '5px 8px', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'Geist, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                  <button onClick={() => removeRule(rule)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', borderRadius: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editRule && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditRule(null)}>
            <motion.div className="modal-content" style={{ maxWidth: 480 }} initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.2rem', color: 'var(--text-1)', fontWeight: 400 }}>Edit Rule</h3>
                <button className="modal-close" onClick={() => setEditRule(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Rule Name</label>
                    <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Room</label>
                    <select value={editForm.room} onChange={e => setEditForm(p => ({ ...p, room: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>
                      {rooms.map(r => <option key={r.id} value={r.name}>Room {r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Delay (minutes)</label>
                    <input type="number" min={1} max={60} value={editForm.delay} onChange={e => setEditForm(p => ({ ...p, delay: parseInt(e.target.value) || 5 }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Trigger (IF)</label>
                    <select value={editForm.trigger} onChange={e => setEditForm(p => ({ ...p, trigger: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>
                      {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Action (THEN)</label>
                    <select value={editForm.action} onChange={e => setEditForm(p => ({ ...p, action: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>
                      {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ padding: '9px 12px', background: 'rgba(0,200,150,0.06)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 16 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Preview: </strong>IF <strong>{TRIGGER_LABELS[editForm.trigger]}</strong> for <strong>{editForm.delay}min</strong> in <strong>Room {editForm.room}</strong> → THEN <strong>{ACTION_LABELS[editForm.action]}</strong>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setEditRule(null)} style={{ flex: 1, padding: '9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveEdit} style={{ flex: 1, padding: '9px', background: 'var(--green)', border: 'none', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Save Changes</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ReportPage({ rooms, selectedRoom }) {
  const room = rooms.find(r => r.name === selectedRoom)
  const totalEvents   = room?.events?.length || 0
  const onEvents      = room?.events?.filter(e => e.status === 'on').length || 0
  const offEvents     = totalEvents - onEvents
  const occupancyPct  = totalEvents > 0 ? Math.round((onEvents / totalEvents) * 100) : 0
  const energySaved   = room?.energy_saved_today || 0
  const pesoCost      = (energySaved * ZAMCELCO_RATE).toFixed(2)
  const hoursOn       = room?.energy_logs?.reduce((a, b) => a + b.hours_on, 0).toFixed(1) || 0
  const weekLabels    = room?.energy_logs?.slice(-7).map(l => l.date?.slice(5)) || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const weekHours     = room?.energy_logs?.slice(-7).map(l => l.hours_on) || [0,0,0,0,0,0,0]
  const weekSaved     = room?.energy_logs?.slice(-7).map(l => l.energy_saved) || [0,0,0,0,0,0,0]
  const weeklySavedKWh  = weekSaved.reduce((a, b) => a + b, 0)
  const monthlySaving   = (weeklySavedKWh / 7 * 30 * ZAMCELCO_RATE).toFixed(2)
  const yearlySaving    = (weeklySavedKWh / 7 * 365 * ZAMCELCO_RATE).toFixed(2)
  const chartOpts = { responsive: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0e1a14', titleColor: '#fff', bodyColor: '#8fa898' } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 10 } } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 10 } } } } }

  const exportCSV = () => {
    if (!room?.events?.length) return
    const rows = [['Time','Event','Room','Duration','Status']]
    room.events.forEach(e => rows.push([new Date(e.timestamp).toLocaleString(), e.event_type, `Room ${room.name}`, e.duration, e.status === 'on' ? 'Active' : 'Ended']))
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `sec-room-${selectedRoom}-report.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const content = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#0d1a12}.header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #00c896;padding-bottom:20px;margin-bottom:30px}.logo{width:80px;height:80px}.school h1{font-size:18px;margin:0;color:#8b0000}.school h2{font-size:13px;margin:4px 0 0;color:#555;font-weight:normal}h3{color:#00c896;font-size:14px;border-bottom:1px solid #e4ebe7;padding-bottom:6px;margin-top:28px}.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}.stat{background:#f6f8f7;padding:14px;border-radius:8px;border-left:3px solid #00c896}.stat .val{font-size:22px;font-weight:bold;color:#0d1a12}.stat .lbl{font-size:11px;color:#8fa898;text-transform:uppercase;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}th{background:#f6f8f7;padding:8px 10px;text-align:left;color:#8fa898;font-size:10px;text-transform:uppercase}td{padding:8px 10px;border-bottom:1px solid #f3f7f5;color:#4a5e52}.projection{background:#f0fdf8;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-top:16px}.projection h4{margin:0 0 10px;color:#065f46;font-size:13px}.proj-row{display:flex;justify-content:space-between;margin:6px 0;font-size:12px}.footer{margin-top:40px;padding-top:12px;border-top:1px solid #e4ebe7;font-size:10px;color:#8fa898;text-align:center}</style></head><body><div class="header"><img class="logo" src="${WMSU_LOGO}" onerror="this.style.display='none'" /><div class="school"><h1>Western Mindanao State University</h1><h2>College of Computing Studies — Smart Environment Classroom (SEC)</h2><div style="font-size:11px;color:#8fa898;margin-top:4px;">Baliwasan Road, Zamboanga City · Generated: ${new Date().toLocaleString()}</div></div></div><h3>Weekly Energy Report — Room ${selectedRoom}</h3><div class="stat-grid"><div class="stat"><div class="val">${totalEvents}</div><div class="lbl">Total Events</div></div><div class="stat"><div class="val">${hoursOn}h</div><div class="lbl">Total Hours ON</div></div><div class="stat"><div class="val">₱${pesoCost}</div><div class="lbl">Peso Savings</div></div><div class="stat"><div class="val">${occupancyPct}%</div><div class="lbl">Occupancy Rate</div></div><div class="stat"><div class="val">${energySaved.toFixed(3)}</div><div class="lbl">kWh Saved</div></div><div class="stat"><div class="val">${onEvents}</div><div class="lbl">Motion Detections</div></div></div><div class="projection"><h4>📈 Projected Savings</h4><div class="proj-row"><span>Weekly average saved</span><strong>${(weeklySavedKWh/7).toFixed(3)} kWh/day</strong></div><div class="proj-row"><span>Estimated monthly savings</span><strong>₱${monthlySaving}</strong></div><div class="proj-row"><span>Estimated annual savings</span><strong>₱${yearlySaving}</strong></div><div class="proj-row"><span>ZAMCELCO rate applied</span><strong>₱${ZAMCELCO_RATE}/kWh</strong></div></div><h3>Daily Energy Log</h3><table><thead><tr><th>Date</th><th>Hours ON</th><th>Energy Saved (kWh)</th><th>Peso Value</th></tr></thead><tbody>${(room?.energy_logs?.slice(-7)||[]).map(l=>`<tr><td>${l.date}</td><td>${l.hours_on}h</td><td>${(l.energy_saved||0).toFixed(3)}</td><td>₱${((l.energy_saved||0)*ZAMCELCO_RATE).toFixed(2)}</td></tr>`).join('')}</tbody></table><h3>Recent Events (Last 20)</h3><table><thead><tr><th>Time</th><th>Event</th><th>Duration</th><th>Status</th></tr></thead><tbody>${(room?.events||[]).slice(0,20).map(e=>`<tr><td>${new Date(e.timestamp).toLocaleString()}</td><td>${e.event_type}</td><td>${e.duration||'—'}</td><td>${e.status==='on'?'Active':'Ended'}</td></tr>`).join('')}</tbody></table><div class="footer">SEC — Smart Environment Classroom · BSIT 3A · CCS Dept · WMSU Zamboanga City · System-generated report</div></body></html>`
    const w = window.open('', '_blank'); w.document.write(content); w.document.close(); w.focus(); setTimeout(() => w.print(), 600)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="report-header">
        <div>
          <h2 className="report-title">Weekly Report — Room {selectedRoom}</h2>
          <p className="report-sub">Energy usage, occupancy, and projected savings</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="export-btn" onClick={exportCSV}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <button className="export-btn" onClick={exportPDF} style={{ color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF
          </button>
        </div>
      </div>
      <div style={{ background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 22 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-1)', marginBottom: 10 }}>📈 Projected Savings</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[{ label: 'Estimated Monthly', val: `₱${monthlySaving}` }, { label: 'Estimated Annual', val: `₱${yearlySaving}` }, { label: 'Avg kWh/day saved', val: `${(weeklySavedKWh/7).toFixed(3)} kWh` }].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.4rem', color: 'var(--green)' }}>{s.val}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 8, textAlign: 'center' }}>Based on this week's average · ZAMCELCO ₱{ZAMCELCO_RATE}/kWh · 8hr daily baseline</div>
      </div>
      <div className="report-stat-grid">
        {[{ icon: '⚡', val: totalEvents, label: 'Total Events', bg: 'rgba(0,200,150,0.1)' }, { icon: '🕐', val: `${hoursOn}h`, label: 'Total Hours ON', bg: 'rgba(99,102,241,0.1)' }, { icon: '₱', val: `₱${pesoCost}`, label: 'Peso Savings', bg: 'rgba(245,158,11,0.1)' }, { icon: '✓', val: `${occupancyPct}%`, label: 'Occupancy Rate', bg: 'rgba(16,185,129,0.1)' }, { icon: '🔋', val: energySaved.toFixed(2), label: 'kWh Saved', bg: 'rgba(239,68,68,0.1)' }, { icon: '👁', val: onEvents, label: 'Motion Detections', bg: 'rgba(139,92,246,0.1)' }].map((s, i) => (
          <div key={i} className="report-stat-card">
            <div className="report-stat-icon" style={{ background: s.bg, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            <div className="report-stat-val">{s.val}</div>
            <div className="report-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="charts-row" style={{ marginBottom: 20 }}>
        <div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Daily Light Hours</span></div><Bar data={{ labels: weekLabels, datasets: [{ data: weekHours, backgroundColor: 'rgba(0,200,150,0.18)', borderColor: 'rgba(0,200,150,0.75)', borderWidth: 1.5, borderRadius: 6 }] }} options={chartOpts} /></div>
        <div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Energy Savings Trend</span></div><Line data={{ labels: weekLabels, datasets: [{ data: weekSaved, borderColor: 'rgba(0,200,150,0.85)', backgroundColor: 'rgba(0,200,150,0.07)', borderWidth: 2, tension: 0.45, pointBackgroundColor: 'var(--green)', pointRadius: 4, fill: true }] }} options={chartOpts} /></div>
      </div>
      <div className="charts-row">
        <div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Event Breakdown</span></div><div style={{ maxWidth: 200, margin: '0 auto' }}><Doughnut data={{ labels: ['Lights ON','Lights OFF'], datasets: [{ data: [onEvents||1, offEvents||1], backgroundColor: ['rgba(0,200,150,0.8)','rgba(239,68,68,0.7)'], borderWidth: 0 }] }} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#4a5e52', font: { size: 11 } } }, tooltip: { backgroundColor: '#0e1a14', titleColor: '#fff', bodyColor: '#8fa898' } }, cutout: '65%' }} /></div></div>
        <div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Energy Cost — ZAMCELCO ₱{ZAMCELCO_RATE}/kWh</span></div><div className="cost-breakdown">{[['Energy saved today', `${energySaved.toFixed(3)} kWh`], ['Total hours ON', `${hoursOn} hrs`], ['ZAMCELCO rate', `₱${ZAMCELCO_RATE}/kWh`], ['Today savings', `₱${pesoCost}`]].map(([l,v],i) => (<div key={i} className={`cost-row ${i===3?'cost-total':''}`}><span>{l}</span><strong style={i===3?{color:'var(--green)',fontSize:'1.2rem'}:{}}>{v}</strong></div>))}<div className="cost-note">Savings vs 8-hour daily baseline. Projected monthly: ₱{monthlySaving} · Projected annual: ₱{yearlySaving}</div></div></div>
      </div>
    </motion.div>
  )
}

function Wire({ start, end, color = '#00c896', animated = false }) {
  const ref = useRef()
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)]
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
  useFrame(({ clock }) => { if (animated && ref.current) ref.current.material.opacity = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3) })
  return (<line ref={ref} geometry={lineGeometry}><lineBasicMaterial color={color} transparent opacity={animated ? 0.8 : 1} linewidth={2} /></line>)
}

function ESP32Model({ position }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[2.2, 0.12, 1.1]} /><meshStandardMaterial color="#1a5c22" roughness={0.4} metalness={0.4} /></mesh>
      <mesh position={[0.55, 0.12, 0]}><boxGeometry args={[0.7, 0.18, 0.5]} /><meshStandardMaterial color="#c87820" roughness={0.3} metalness={0.6} /></mesh>
      {[-0.9,-0.6,-0.3,0,0.3,0.6,0.9].map((x,i) => (<mesh key={i} position={[x,-0.1,-0.58]}><boxGeometry args={[0.08,0.15,0.08]} /><meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} /></mesh>))}
      {[-0.9,-0.6,-0.3,0,0.3,0.6,0.9].map((x,i) => (<mesh key={i} position={[x,-0.1,0.58]}><boxGeometry args={[0.08,0.15,0.08]} /><meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} /></mesh>))}
      <mesh position={[-0.3,0.12,-0.3]}><sphereGeometry args={[0.06,8,8]} /><meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={2} /></mesh>
      <pointLight position={[0,0.5,0]} intensity={0.6} color="#00ff88" distance={2} />
      <Html position={[0,0.5,0]} center><div style={{ background:'rgba(0,15,5,0.9)',color:'#00ff88',padding:'3px 8px',borderRadius:4,fontSize:10,fontFamily:'monospace',whiteSpace:'nowrap',border:'1px solid rgba(0,255,136,0.4)' }}>ESP32</div></Html>
    </group>
  )
}

function PIRModel({ position }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[0.8,0.1,0.8]} /><meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.6} /></mesh>
      <mesh position={[0,0.25,0]}><sphereGeometry args={[0.35,16,16]} /><meshStandardMaterial color="#f0e8c8" transparent opacity={0.85} roughness={0.1} /></mesh>
      <mesh position={[0,0.25,0]}><sphereGeometry args={[0.28,16,16]} /><meshStandardMaterial color="#cc4444" emissive="#cc2222" emissiveIntensity={0.4} roughness={0.2} /></mesh>
      {[[-0.25,-0.08,0],[0,-0.08,0],[0.25,-0.08,0]].map((p,i) => (<mesh key={i} position={p}><boxGeometry args={[0.05,0.2,0.05]} /><meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} /></mesh>))}
      <Html position={[0,0.8,0]} center><div style={{ background:'rgba(15,0,0,0.9)',color:'#ff6666',padding:'3px 8px',borderRadius:4,fontSize:10,fontFamily:'monospace',whiteSpace:'nowrap',border:'1px solid rgba(255,100,100,0.4)' }}>PIR Sensor</div></Html>
    </group>
  )
}

function RelayModel({ position }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[1.4,0.1,0.8]} /><meshStandardMaterial color="#0a3a7a" roughness={0.4} metalness={0.4} /></mesh>
      <mesh position={[0.2,0.18,0]}><boxGeometry args={[0.5,0.22,0.5]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.8} /></mesh>
      <mesh position={[-0.4,0.12,0]}><boxGeometry args={[0.35,0.18,0.6]} /><meshStandardMaterial color="#1a7a3a" roughness={0.5} metalness={0.3} /></mesh>
      <mesh position={[0.55,0.18,0.2]}><sphereGeometry args={[0.065,8,8]} /><meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={1.5} /></mesh>
      <mesh position={[0.55,0.18,-0.2]}><sphereGeometry args={[0.065,8,8]} /><meshStandardMaterial color="#22ff22" emissive="#22ff22" emissiveIntensity={1.5} /></mesh>
      <Html position={[0,0.6,0]} center><div style={{ background:'rgba(0,0,20,0.9)',color:'#4488ff',padding:'3px 8px',borderRadius:4,fontSize:10,fontFamily:'monospace',whiteSpace:'nowrap',border:'1px solid rgba(68,136,255,0.4)' }}>Relay Module</div></Html>
    </group>
  )
}

function BulbModel({ position, isOn = false }) {
  const glowRef = useRef()
  useFrame(({ clock }) => { if (glowRef.current && isOn) glowRef.current.intensity = 1.5 + 0.3 * Math.sin(clock.elapsedTime * 2) })
  return (
    <group position={position}>
      <mesh position={[0,0.15,0]}><cylinderGeometry args={[0.18,0.22,0.3,12]} /><meshStandardMaterial color="#888" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0,0.55,0]}><sphereGeometry args={[0.3,16,16]} /><meshStandardMaterial color={isOn?'#fff9c4':'#d0d0d0'} transparent opacity={0.9} emissive={isOn?'#ffeb3b':'#000'} emissiveIntensity={isOn?1.5:0} roughness={0.1} /></mesh>
      {isOn && <pointLight ref={glowRef} position={[0,0.6,0]} intensity={1.5} color="#fffde7" distance={4} />}
      <Html position={[0,1.1,0]} center><div style={{ background:isOn?'rgba(30,20,0,0.9)':'rgba(10,10,10,0.9)',color:isOn?'#ffd700':'#aaa',padding:'3px 8px',borderRadius:4,fontSize:10,fontFamily:'monospace',whiteSpace:'nowrap',border:`1px solid ${isOn?'rgba(255,215,0,0.4)':'rgba(150,150,150,0.3)'}` }}>{isOn?'💡 ON':'Bulb (2.5V)'}</div></Html>
    </group>
  )
}

function BatteryModel({ position }) {
  return (
    <group position={position}>
      <mesh><cylinderGeometry args={[0.4,0.4,1.2,16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.5} /></mesh>
      <mesh position={[0,0.65,0]}><cylinderGeometry args={[0.15,0.15,0.1,12]} /><meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} /></mesh>
      <mesh position={[0,0,0]}><cylinderGeometry args={[0.42,0.42,0.5,16]} /><meshStandardMaterial color="#cc2200" roughness={0.6} /></mesh>
      <Html position={[0,1.1,0]} center><div style={{ background:'rgba(10,0,0,0.9)',color:'#ff6644',padding:'3px 8px',borderRadius:4,fontSize:10,fontFamily:'monospace',whiteSpace:'nowrap',border:'1px solid rgba(255,100,68,0.4)' }}>9V Battery</div></Html>
    </group>
  )
}

function BreadboardModel({ position }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[2.5,0.08,1.0]} /><meshStandardMaterial color="#f5f5f5" roughness={0.7} /></mesh>
      {[-0.08,0.08].map((z,i) => (<mesh key={i} position={[0,0.05,z*3.5]}><boxGeometry args={[2.45,0.03,0.06]} /><meshStandardMaterial color={i===0?'#cc4444':'#4444cc'} roughness={0.5} /></mesh>))}
      {[-1.0,-0.6,-0.2,0.2,0.6,1.0].map((x,i) => [-0.2,-0.1,0,0.1,0.2].map((z,j) => (<mesh key={`${i}-${j}`} position={[x,0.05,z]}><boxGeometry args={[0.04,0.04,0.04]} /><meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} /></mesh>)))}
      <Html position={[0,0.4,0]} center><div style={{ background:'rgba(10,10,10,0.9)',color:'#ccc',padding:'3px 8px',borderRadius:4,fontSize:10,fontFamily:'monospace',whiteSpace:'nowrap',border:'1px solid rgba(200,200,200,0.2)' }}>Breadboard</div></Html>
    </group>
  )
}

function WiringScene({ showMotion }) {
  return (
    <>
      <ambientLight intensity={0.6} color="#fff5e8" />
      <directionalLight position={[5,8,5]} intensity={0.8} color="#fff8e0" castShadow />
      <pointLight position={[-5,5,-3]} intensity={0.4} color="#88ccff" distance={15} />
      <ESP32Model position={[0,0,0]} />
      <PIRModel position={[-4.5,0,-2]} />
      <RelayModel position={[3.5,0,-1.5]} />
      <BulbModel position={[3.5,0,1.5]} isOn={showMotion} />
      <BatteryModel position={[5.5,0,1.5]} />
      <BreadboardModel position={[0,0,2.2]} />
      <Wire start={[-4.5,0.1,-1.6]} end={[-0.9,0.1,-0.55]} color="#ff4444" animated={showMotion} />
      <Wire start={[-4.5,0.1,-2.4]} end={[-0.5,0.1,-0.55]} color="#222222" />
      <Wire start={[-4.5,0.1,-1.8]} end={[-0.7,0.1,-0.55]} color="#00c896" animated={showMotion} />
      <Wire start={[0.9,0.1,-0.55]} end={[2.1,0.1,-1.5]} color="#4488ff" animated={showMotion} />
      <Wire start={[1.1,0.1,-0.55]} end={[2.1,0.1,-1.8]} color="#222222" />
      <Wire start={[0.7,0.1,-0.55]} end={[2.1,0.1,-1.2]} color="#ff4444" />
      <Wire start={[4.9,0.1,-1.5]} end={[5.1,0.1,1.0]} color="#ff6600" animated={showMotion} />
      <Wire start={[5.5,0.55,1.5]} end={[5.3,0.1,1.0]} color="#ff4444" />
      <Wire start={[3.5,0.55,1.5]} end={[4.9,0.1,-1.2]} color="#ff8844" animated={showMotion} />
      <Wire start={[0,0.1,0.55]} end={[0,0.1,1.7]} color="#00c896" />
      <Wire start={[0.3,0.1,0.55]} end={[0.3,0.1,1.7]} color="#222222" />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={4} maxDistance={20} />
    </>
  )
}

function ESP32WiringModel({ showMotion }) {
  return (
    <div style={{ width: '100%', height: 400, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#08100c' }}>
      <Canvas camera={{ position: [6,6,8], fov: 55 }} shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
        <Suspense fallback={null}><WiringScene showMotion={showMotion} /></Suspense>
      </Canvas>
    </div>
  )
}

function DevicePlaceholder({ currentRoom }) {
  const [modelMotion, setModelMotion] = useState(false)
  const [activeStep, setActiveStep]   = useState(null)
  const isConnected = currentRoom?.last_motion && (Date.now() - new Date(currentRoom.last_motion).getTime()) < 30000

  const ESP32_CODE = `#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* ssid      = "oh u dont have load? oh how poor";
const char* password  = "gelatnigga";
const char* serverURL = "https://sec-backend-i03g.onrender.com/api/motion/";

const int PIR_PIN   = 14;
const int RELAY_PIN = 26;
const char* ROOM    = "A";

unsigned long motionEndTime   = 0;
bool waitingToTurnOff         = false;
const unsigned long LIGHTS_OFF_DELAY = 7000;
int lastState = LOW;

void wakeServer() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, serverURL);
  http.setTimeout(30000);
  int code = http.GET();
  Serial.printf("[HTTP] Wake: %d\\n", code);
  http.end();
}

void sendEvent(const char* event) {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, serverURL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);
  String body = "{\\"room\\":\\"" + String(ROOM) + "\\",\\"event\\":\\"" + String(event) + "\\",\\"source\\":\\"esp32\\"}";
  Serial.println("[HTTP] POST -> " + body);
  unsigned long t = millis();
  int code = http.POST(body);
  Serial.printf("[HTTP] %d in %lums\\n", code, millis() - t);
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.println("\\n[WiFi] Connected: " + WiFi.localIP().toString());
  wakeServer();
  Serial.println("[READY] Monitoring PIR...");
}

void loop() {
  int state = digitalRead(PIR_PIN);
  Serial.printf("[PIR] %d\\n", state);
  if (state == HIGH && lastState == LOW) {
    waitingToTurnOff = false;
    digitalWrite(RELAY_PIN, LOW);
    Serial.println("[PIR] Motion -> Lights ON");
    sendEvent("Lights ON");
  }
  if (state == LOW && lastState == HIGH) {
    waitingToTurnOff = true;
    motionEndTime = millis();
  }
  if (waitingToTurnOff && (millis() - motionEndTime >= LIGHTS_OFF_DELAY)) {
    waitingToTurnOff = false;
    if (digitalRead(PIR_PIN) == LOW) {
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("[PIR] Lights OFF");
      sendEvent("Lights OFF");
    }
  }
  lastState = state;
  delay(100);
}`

  const tutorialSteps = [
    { num: 1, color: '#00c896', title: 'Gather Your Components', desc: 'You need: ESP32 board, PIR motion sensor (HC-SR501), 5V Relay module, 2.5V bulb with socket, 9V battery with connector, breadboard, and jumper wires.', detail: 'Make sure your relay module is rated for at least 5V coil voltage. The 9V battery connects to the relay output side to power the 2.5V bulb through a resistor.' },
    { num: 2, color: '#6366f1', title: 'Wire the PIR Sensor to ESP32', desc: 'PIR VCC → 3.3V pin on ESP32. PIR GND → GND on ESP32. PIR OUT → GPIO 14 on ESP32.', detail: 'The PIR sensor outputs HIGH (3.3V) when motion is detected and LOW when idle. GPIO 14 reads this signal. No resistor needed for the PIR data line.' },
    { num: 3, color: '#f59e0b', title: 'Wire the Relay Module to ESP32', desc: 'Relay VCC → 5V pin (VIN) on ESP32. Relay GND → GND on ESP32. Relay IN → GPIO 26 on ESP32.', detail: 'GPIO 26 controls the relay coil. When ESP32 sends LOW to GPIO 26, the relay closes its switch. Use the NO (Normally Open) terminal on the relay for the bulb circuit.' },
    { num: 4, color: '#ef4444', title: 'Wire the 9V Battery + Resistor + Bulb', desc: 'Battery (+) → Relay COM terminal. Relay NO terminal → Resistor (680Ω) → Bulb (+). Bulb (−) → Battery (−).', detail: 'The 9V battery powers the bulb through the relay. Since your bulb is 2.5V 3W, use a 680Ω resistor (9V − 2.5V = 6.5V drop). This protects your bulb from burning out.' },
    { num: 5, color: '#8b5cf6', title: 'Connect ESP32 to Phone Hotspot', desc: 'Enable hotspot on your phone. The ESP32 code already has your hotspot credentials built in.', detail: 'Make sure your Django backend server is reachable. The code connects to the Render backend directly over HTTPS.' },
    { num: 6, color: '#10b981', title: 'Flash the Code via Arduino IDE', desc: 'Install Arduino IDE → Add ESP32 board URL in preferences → Install "ESP32 by Espressif" → Select your board → Upload.', detail: 'Board manager URL: https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json — Select board: "ESP32 Dev Module". Open Serial Monitor at 115200 baud.' },
    { num: 7, color: '#f59e0b', title: 'Test the Full System', desc: 'Power on ESP32 → watch Serial Monitor for WiFi connection → wave your hand in front of PIR → bulb should turn ON and dashboard should auto-navigate.', detail: 'Dashboard polls every 2 seconds. When motion is detected the dashboard will automatically switch to the Dashboard tab and select the active room.' }
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>ESP32 Device</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Hardware configuration, wiring guide, and Arduino code</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 22 }}>
        <div style={{ background: 'var(--dark)', borderRadius: 12, padding: 22, color: 'white', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem', color: 'var(--green)' }}>ESP32 Device</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.71rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: isConnected ? 'rgba(0,200,150,0.15)' : 'rgba(239,68,68,0.15)', color: isConnected ? 'var(--green)' : '#f87171' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: 'livePulse 1.8s infinite' }} />
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          {[['Room', currentRoom?.name || '—'], ['Lights', currentRoom?.is_active ? 'ON' : 'OFF'], ['Last Ping', currentRoom?.last_motion ? new Date(currentRoom.last_motion).toLocaleTimeString() : '—'], ['Endpoint', 'POST /api/motion/']].map(([l,v],i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span>{l}</span><strong style={{ color: 'rgba(255,255,255,0.8)' }}>{v}</strong>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 14 }}>Pin Configuration</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['PIR VCC','3.3V'],['PIR GND','GND'],['PIR OUT','GPIO 14'],['Relay IN','GPIO 26'],['Relay VCC','5V (VIN)'],['Relay GND','GND'],['Bulb (+)','Relay NO'],['Battery (+)','Relay COM'],['Resistor','680Ω series']].map(([l,v],i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.79rem', color: 'var(--text-3)', fontWeight: 500 }}>{l}</span>
                  <span style={{ fontSize: '0.79rem', color: 'var(--text-1)', fontWeight: 600, fontFamily: 'monospace' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 6 }}>ESP32 Arduino Code</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.6 }}>Latest version with HTTPS, non-blocking motion timer, and 2s dashboard polling support.</p>
            <div style={{ background: 'var(--dark)', borderRadius: 10, padding: '18px 20px', overflow: 'auto', maxHeight: 380 }}>
              <pre style={{ color: '#00ff88', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{ESP32_CODE}</pre>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 20 }}>Step-by-Step Wiring Tutorial</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {tutorialSteps.map((step) => (
                <div key={step.num} onClick={() => setActiveStep(activeStep === step.num ? null : step.num)}
                  style={{ background: activeStep === step.num ? `${step.color}08` : 'var(--bg)', border: `1.5px solid ${activeStep === step.num ? step.color + '44' : 'var(--border)'}`, borderRadius: 10, padding: '16px', cursor: 'pointer', transition: 'all 0.18s' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 1 }}>{step.num}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{step.title}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{step.desc}</div>
                      <AnimatePresence>
                        {activeStep === step.num && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                            <div style={{ marginTop: 12, padding: '12px 14px', background: `${step.color}10`, border: `1px solid ${step.color}30`, borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.7 }}>💡 {step.detail}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div style={{ color: activeStep === step.num ? step.color : 'var(--text-3)', fontSize: '0.9rem', flexShrink: 0 }}>{activeStep === step.num ? '▲' : '▼'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 4 }}>3D Circuit Wiring Model</div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', lineHeight: 1.6 }}>Interactive 3D view. Drag to orbit · Scroll to zoom · Right-click to pan.</p>
              </div>
              <button onClick={() => setModelMotion(!modelMotion)}
                style={{ padding: '8px 18px', background: modelMotion ? 'rgba(0,200,150,0.1)' : 'var(--bg)', border: `1.5px solid ${modelMotion ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', fontWeight: 500, color: modelMotion ? 'var(--green)' : 'var(--text-2)', cursor: 'pointer', transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: modelMotion ? 'var(--green)' : '#ccc', display: 'inline-block', animation: modelMotion ? 'livePulse 1.8s infinite' : 'none' }} />
                {modelMotion ? 'Motion Active — Bulb ON' : 'Simulate Motion'}
              </button>
            </div>
            <ESP32WiringModel showMotion={modelMotion} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function SettingsPlaceholder({ userRole }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>System Settings</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Technical details and system configuration</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-1)', marginBottom: 14 }}>Project Location</div>
          {[['Institution','Western Mindanao State University'],['Address','Baliwasan Road, Camp B, Zamboanga City, Philippines'],['Department','College of Computing Studies (CCS)'],['Building','CCS Department Building']].map(([l,v],i) => (
            <div key={i} style={{ fontSize: '0.84rem', color: 'var(--text-2)', marginBottom: 6 }}><strong style={{ color: 'var(--text-1)' }}>{l}:</strong> {v}</div>
          ))}
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-1)', marginBottom: 14 }}>Technical Stack</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['Frontend','React.js 18 + Vite'],['Backend','Django 5 + DRF'],['Auth','JWT (simplejwt)'],['Charts','Chart.js + react-chartjs-2'],['3D Engine','React Three Fiber + Drei'],['Animations','Framer Motion'],['Production DB','PostgreSQL (Render)'],['Local DB','SQLite (Development)'],['Frontend Deploy','Vercel'],['Backend Deploy','Render'],['Hardware','ESP32 Dev Module'],['Sensor','HC-SR501 PIR + 5V Relay']].map(([l,v],i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '9px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 90, flexShrink: 0 }}>{l}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-1)' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'rgba(0,200,150,0.06)', borderRadius: 10, border: '1px solid rgba(0,200,150,0.2)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.79rem' }}>ZC</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-1)' }}>ZAMCELCO</div>
              <div style={{ fontSize: '0.79rem', color: 'var(--text-3)' }}>Zamboanga City Electric Cooperative · Rate: ₱{ZAMCELCO_RATE}/kWh</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function AboutPlaceholder() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>About SEC</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Project information and team details</p>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap' }}>
          <img src={WMSU_LOGO} alt="WMSU Logo" style={{ width: 80, height: 80, borderRadius: 8 }} onError={e => e.target.style.display = 'none'} />
          <div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)', marginBottom: 4 }}>Smart Environment Classroom (SEC)</div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.75 }}>IoT-based smart lighting automation system designed for classroom environments. Uses an ESP32 microcontroller with a PIR motion sensor and relay module to automatically control lighting based on room occupancy, reducing energy waste and operational costs at Western Mindanao State University.</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[['Project Type','IoT Automation System'],['Subject','Internet of Things (IoT)'],['Course','BSIT 3A'],['Program','BS Information Technology'],['College','College of Computing Studies'],['University','Western Mindanao State University']].map(([l,v],i) => (
            <div key={i} style={{ padding: '9px 12px', background: 'var(--bg)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.69rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-1)' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 12 }}>Developers</div>
        {[{ name: 'Angel Garcia', role: 'Lead Developer & Hardware Integration', color: '#00c896' }, { name: 'Kurt Adlrich Canilang', role: 'Backend Developer & System Architecture', color: '#6366f1' }, { name: 'John Paul Enriquez', role: 'Frontend Developer & UI/UX Design', color: '#f59e0b' }].map((dev, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg)', borderRadius: 9, marginBottom: 8, border: '1px solid var(--border)' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: dev.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>{dev.name.split(' ').map(n => n[0]).join('')}</div>
            <div><div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-1)' }}>{dev.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{dev.role}</div></div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function MultiRoomPlaceholder({ rooms }) {
  const chartOpts = { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#4a5e52', font: { size: 11 } } }, tooltip: { backgroundColor: '#0e1a14', titleColor: '#fff', bodyColor: '#8fa898' } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } } } }
  const colors = ['rgba(0,200,150,0.7)', 'rgba(99,102,241,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)']
  const weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Multi-Room Comparison</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Compare energy across all rooms</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(rooms.length, 4)}, 1fr)`, gap: 14, marginBottom: 22 }}>
        {rooms.map((room, i) => (
          <div key={room.id} style={{ background: 'var(--surface)', border: `1.5px solid ${room.is_active ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, bottom: 0, background: colors[i], borderRadius: '3px 0 0 3px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)' }}>Room {room.name}</div>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: room.is_active ? '#d1fae5' : '#fee2e2', color: room.is_active ? '#065f46' : '#991b1b' }}>{room.is_active ? 'ON' : 'OFF'}</span>
            </div>
            {[['Energy Saved', `${(room.energy_saved_today||0).toFixed(3)} kWh`], ['Peso', `₱${((room.energy_saved_today||0)*ZAMCELCO_RATE).toFixed(2)}`], ['Status', room.occupancy ? 'Occupied' : 'Vacant']].map(([l,v],j) => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.79rem', marginBottom: 5 }}><span style={{ color: 'var(--text-3)' }}>{l}</span><strong style={{ color: 'var(--text-1)' }}>{v}</strong></div>
            ))}
          </div>
        ))}
      </div>
      <div className="charts-row">
        <div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Energy Saved — All Rooms</span></div><Bar data={{ labels: weekDays, datasets: rooms.map((r,i) => ({ label: `Room ${r.name}`, data: r.energy_logs?.slice(-7).map(l => l.energy_saved) || weekDays.map(() => Math.random()*0.5), backgroundColor: colors[i], borderRadius: 5 })) }} options={chartOpts} /></div>
        <div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Light Hours — All Rooms</span></div><Line data={{ labels: weekDays, datasets: rooms.map((r,i) => ({ label: `Room ${r.name}`, data: r.energy_logs?.slice(-7).map(l => l.hours_on) || weekDays.map(() => Math.random()*4), borderColor: colors[i], backgroundColor: colors[i].replace('0.7','0.08'), borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: colors[i], pointRadius: 4 })) }} options={chartOpts} /></div>
      </div>
    </motion.div>
  )
}

function InsightsPlaceholder({ rooms, selectedRoom, savedInsights, onSaveInsight, onDeleteInsight }) {
  const [insights, setInsights] = useState([])
  const [loading, setLoading]   = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const room = rooms.find(r => r.name === selectedRoom)

  const generate = () => {
    setLoading(true)
    setTimeout(() => {
      const energySaved = room?.energy_saved_today || 0
      const events = room?.events || []
      const onEvents = events.filter(e => e.status === 'on').length
      const occupancyRate = events.length > 0 ? Math.round((onEvents / events.length) * 100) : 0
      const hoursOn = (room?.energy_logs || []).reduce((a, b) => a + (b.hours_on || 0), 0)
      const weeklySaved = (room?.energy_logs || []).reduce((a, b) => a + (b.energy_saved || 0), 0)
      const res = []
      if (energySaved > 0.5) res.push({ type: 'success', title: 'Good Energy Performance', body: `Room ${selectedRoom} saved ${energySaved.toFixed(3)} kWh today.`, saving: `₱${(energySaved*ZAMCELCO_RATE).toFixed(2)} saved`, action: 'Maintain current settings' })
      else res.push({ type: 'warning', title: 'Low Savings Detected', body: `Only ${energySaved.toFixed(3)} kWh saved today.`, saving: 'Increase auto-off frequency', action: 'Reduce timeout to 3 minutes' })
      if (occupancyRate > 60) res.push({ type: 'success', title: 'High Room Utilization', body: `${occupancyRate}% occupancy rate — room is well-used.`, saving: 'Optimal usage', action: 'No action needed' })
      else res.push({ type: 'info', title: 'Low Occupancy', body: `${occupancyRate}% occupancy detected.`, saving: 'Verify PIR placement', action: 'Reposition sensor' })
      if (hoursOn > 10) res.push({ type: 'warning', title: 'Extended Light Usage', body: `${hoursOn.toFixed(1)} total hours across the week.`, saving: `~₱${((hoursOn-6)*ZAMCELCO_RATE*0.09).toFixed(2)} excess`, action: 'Check relay timeout' })
      else res.push({ type: 'tip', title: 'Efficient Light Schedule', body: `${hoursOn.toFixed(1)} hours — within expected range.`, saving: 'On track', action: 'Continue monitoring' })
      res.push({ type: 'success', title: 'Weekly Projection', body: `Saving ~${(weeklySaved/7*30).toFixed(2)} kWh/month at this rate.`, saving: `₱${((weeklySaved/7*30)*ZAMCELCO_RATE).toFixed(2)} projected/month`, action: 'Track monthly trend' })
      setInsights(res.slice(0, 4)); setLoading(false)
    }, 1200)
  }

  const typeConfig = {
    success: { bg: 'rgba(0,200,150,0.08)', border: 'rgba(0,200,150,0.25)', icon: '✓', color: '#00c896' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '⚠', color: '#f59e0b' },
    info:    { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', icon: 'ℹ', color: '#6366f1' },
    tip:     { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', icon: '→', color: '#10b981' },
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Smart Insights — Room {selectedRoom}</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Energy analysis and optimization recommendations</p></div>
        <button onClick={generate} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--dark)', color: 'var(--green)', border: '1.5px solid rgba(0,200,150,0.3)', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}>
          {loading ? 'Analyzing…' : '★ Generate AI Insights'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[{ v: false, l: 'Current Insights' }, { v: true, l: `Saved (${savedInsights.length})` }].map(b => (
          <button key={b.l} onClick={() => setShowSaved(b.v)} style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${showSaved===b.v?'var(--green)':'var(--border)'}`, background: showSaved===b.v?'var(--green-dim)':'var(--bg)', color: showSaved===b.v?'var(--green)':'var(--text-3)', fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>{b.l}</button>
        ))}
      </div>
      {!showSaved && insights.length === 0 && !loading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>🧠</div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)', marginBottom: 6 }}>Ready to Analyze</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-3)', lineHeight: 1.7 }}>Click "Generate AI Insights" for personalized energy recommendations.</div>
        </div>
      )}
      {!showSaved && insights.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {insights.map((ins, i) => {
            const cfg = typeConfig[ins.type] || typeConfig.info
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*0.08 }}
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: cfg.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>{cfg.icon}</div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{ins.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{ins.body}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ background: cfg.border, borderRadius: 6, padding: '3px 9px', fontSize: '0.73rem', fontWeight: 600, color: cfg.color }}>{ins.saving}</span>
                  <span style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '3px 9px', fontSize: '0.71rem', color: 'var(--text-3)' }}>→ {ins.action}</span>
                </div>
                <button onClick={() => onSaveInsight(ins)} style={{ padding: '5px 11px', background: 'none', border: `1px solid ${cfg.border}`, borderRadius: 6, fontSize: '0.73rem', color: cfg.color, fontWeight: 500, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Save</button>
              </motion.div>
            )
          })}
        </div>
      )}
      {showSaved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {savedInsights.length === 0
            ? <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.84rem' }}>No saved insights yet.</div>
            : savedInsights.map((ins, i) => {
              const cfg = typeConfig[ins.type] || typeConfig.info
              return (
                <div key={ins.id} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-1)' }}>{ins.title}</span><span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{new Date(ins.date).toLocaleDateString()}</span></div>
                    <div style={{ fontSize: '0.79rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{ins.body}</div>
                  </div>
                  <button onClick={() => onDeleteInsight(ins.id)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: '0.71rem', color: 'var(--red)', cursor: 'pointer', padding: '4px 9px', fontFamily: 'Geist, sans-serif' }}>Delete</button>
                </div>
              )
            })
          }
        </div>
      )}
    </motion.div>
  )
}

function SimulationPlaceholder({ rooms, selectedRoom, loadRooms, addToast }) {
  const [simulating, setSimulating]           = useState(false)
  const [simOff, setSimOff]                   = useState(false)
  const [scenarioRunning, setScenarioRunning] = useState(false)
  const [scenarioLog, setScenarioLog]         = useState([])
  const [scenarioProgress, setScenarioProgress] = useState(0)
  const [activeScenario, setActiveScenario]   = useState(null)
  const room = rooms.find(r => r.name === selectedRoom)

  const handleOn  = async () => { setSimulating(true); try { await simulateMotion(selectedRoom); await loadRooms(); addToast('Lights ON!', 'success') } catch { addToast('Failed', 'warning') } finally { setSimulating(false) } }
  const handleOff = async () => { setSimOff(true); try { await simulateLightsOff(selectedRoom); await loadRooms(); addToast('Lights OFF!', 'info') } catch { addToast('Failed', 'warning') } finally { setSimOff(false) } }

  const scenarios = [
    { id: 'morning', name: 'Morning Class', desc: 'Students arrive at 7AM, 3-hour class, room clears.', steps: [{ label: 'Students arriving', action: 'on', delay: 600 },{ label: 'Class in session', action: null, delay: 2000 },{ label: 'Break time', action: 'off', delay: 1000 },{ label: 'Class resumes', action: 'on', delay: 1500 },{ label: 'Class ends', action: 'off', delay: 800 }] },
    { id: 'idle',    name: 'Idle Detection', desc: 'Lights left on with no occupancy — tests auto-off.', steps: [{ label: 'Lights ON', action: 'on', delay: 600 },{ label: 'No motion', action: null, delay: 2000 },{ label: 'Idle timeout', action: null, delay: 1500 },{ label: 'Auto OFF', action: 'off', delay: 800 }] },
    { id: 'busy',    name: 'Busy Day', desc: 'Multiple classes back-to-back throughout the day.', steps: [{ label: '1st class ON', action: 'on', delay: 500 },{ label: 'Break', action: 'off', delay: 800 },{ label: '2nd class ON', action: 'on', delay: 500 },{ label: 'Lunch', action: 'off', delay: 800 },{ label: 'Afternoon class', action: 'on', delay: 500 },{ label: 'Day ends', action: 'off', delay: 700 }] },
  ]

  const runScenario = async (sc) => {
    setActiveScenario(sc.id); setScenarioRunning(true); setScenarioLog([]); setScenarioProgress(0)
    for (let i = 0; i < sc.steps.length; i++) {
      const step = sc.steps[i]
      setScenarioLog(prev => [...prev, { label: step.label, time: new Date().toLocaleTimeString(), status: 'running' }])
      setScenarioProgress(Math.round(((i+1)/sc.steps.length)*100))
      if (step.action === 'on')  { try { await simulateMotion(selectedRoom);    await loadRooms() } catch {} }
      if (step.action === 'off') { try { await simulateLightsOff(selectedRoom); await loadRooms() } catch {} }
      await new Promise(r => setTimeout(r, step.delay))
      setScenarioLog(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s))
    }
    setScenarioRunning(false); addToast(`"${sc.name}" complete!`, 'success')
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 20 }}><h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Simulation Mode</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Test system behavior without physical hardware</p></div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, marginBottom: 18 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 16 }}>Manual Controls — Room {selectedRoom}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleOn}  disabled={simulating||scenarioRunning} className="simulate-btn">{simulating ? 'Simulating…' : '⚡ Lights ON'}</button>
          <button onClick={handleOff} disabled={simOff||scenarioRunning}     className="simulate-btn sim-off">{simOff ? 'Turning off…' : '🌑 Lights OFF'}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 8 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: room?.is_active ? 'var(--green)' : '#ccc', animation: room?.is_active ? 'livePulse 1.8s infinite' : 'none' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>Current: <strong>{room?.is_active ? 'ON' : 'OFF'}</strong></span>
          </div>
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 16 }}>Scenario Runner</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: scenarioRunning ? 16 : 0 }}>
          {scenarios.map(sc => (
            <div key={sc.id} style={{ background: activeScenario===sc.id ? 'rgba(0,200,150,0.06)' : 'var(--bg)', border: `1.5px solid ${activeScenario===sc.id ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-1)', marginBottom: 5 }}>{sc.name}</div>
              <div style={{ fontSize: '0.77rem', color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 12 }}>{sc.desc}</div>
              <button onClick={() => runScenario(sc)} disabled={scenarioRunning} style={{ width: '100%', padding: '8px', background: 'var(--dark)', color: 'var(--green)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 7, fontFamily: 'Geist, sans-serif', fontSize: '0.79rem', fontWeight: 500, cursor: scenarioRunning ? 'not-allowed' : 'pointer', opacity: scenarioRunning && activeScenario !== sc.id ? 0.5 : 1 }}>
                {activeScenario===sc.id && scenarioRunning ? '▶ Running…' : '▶ Run'}
              </button>
            </div>
          ))}
        </div>
        <AnimatePresence>
          {scenarioRunning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--dark)', borderRadius: 10, padding: '18px 20px', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: 'var(--green)', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>● Running</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.77rem' }}>{scenarioProgress}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginBottom: 14, overflow: 'hidden' }}>
                <motion.div style={{ height: '100%', background: 'var(--green)', borderRadius: 99 }} animate={{ width: `${scenarioProgress}%` }} />
              </div>
              {scenarioLog.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.69rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', width: 75 }}>{step.time}</span>
                  <span style={{ fontSize: '0.8rem', color: step.status==='done' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)' }}>{step.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.69rem', color: step.status==='done' ? 'var(--green)' : '#f59e0b' }}>{step.status==='done' ? '✓' : '…'}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function DashboardScreen({ onLogout, currentUser }) {
  const userRole = 'admin'

  const [rooms, setRooms]               = useState([])
  const [selectedRoom, setSelectedRoom] = useState('A')
  const [initialLoading, setInitialLoading] = useState(true)
  const [simulating, setSimulating]     = useState(false)
  const [simulatingOff, setSimulatingOff] = useState(false)
  const [clock, setClock]               = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewingDate, setViewingDate]   = useState(null)
  const [historicalData, setHistoricalData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeNav, setActiveNav]       = useState('dashboard')
  const [newEventIds, setNewEventIds]   = useState(new Set())
  const [toasts, setToasts]             = useState([])
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [modalOpen, setModalOpen]       = useState(null)
  const [modalData, setModalData]       = useState(null)
  const [viewMode, setViewMode]         = useState('day')
  const [demoMode, setDemoMode]         = useState(() => { try { return localStorage.getItem('sec_demo') === 'true' } catch { return false } })
  const [savedInsights, setSavedInsights] = useState(() => { try { return JSON.parse(localStorage.getItem('sec_saved_insights') || '[]') } catch { return [] } })
  const [notifications, setNotifications] = useState(() => { try { return JSON.parse(localStorage.getItem('sec_notifs') || '[]') } catch { return [] } })

  const prevEventCounts = useRef({})
  const intervalRef     = useRef(null)
  const pollRef         = useRef(null)
  const toastId         = useRef(0)
  const notifId         = useRef(notifications.length)

  const addToast = (msg, type = 'success') => {
    const id = ++toastId.current
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }

  const pushNotification = useCallback((title, body, type, roomName) => {
    const n = { id: ++notifId.current, title, body, type, roomName, read: false, timeLabel: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }
    setNotifications(prev => {
      const updated = [n, ...prev].slice(0, 30)
      localStorage.setItem('sec_notifs', JSON.stringify(updated))
      return updated
    })
  }, [])

  const deleteNotif    = (id) => setNotifications(prev => { const u = prev.filter(n => n.id !== id); localStorage.setItem('sec_notifs', JSON.stringify(u)); return u })
  const clearAllNotifs = () => { setNotifications([]); localStorage.removeItem('sec_notifs') }
  const markAllRead    = () => setNotifications(prev => { const u = prev.map(n => ({ ...n, read: true })); localStorage.setItem('sec_notifs', JSON.stringify(u)); return u })
  const handleNotifNav = () => { setActiveNav('logs'); markAllRead() }

  const generateDemoData = () => {
    const now = new Date()
    const hours = [2.5, 4.1, 3.2, 5.0, 1.8, 0.5, 3.7]
    const allRooms = ['A', 'B', 'C'].map((name, ri) => {
      const demoEvents = []
      const demoLogs   = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        const h = hours[6-i]; const saved = parseFloat((h*0.09).toFixed(3))
        demoLogs.push({ date: dateStr, hours_on: h, energy_saved: saved })
        const periods = [[7,9],[10,12],[13,15],[15,17]]
        periods.forEach(([sh,eh]) => {
          if (Math.random() < 0.75) {
            const on_t  = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, Math.floor(Math.random()*30))
            const off_t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, Math.floor(Math.random()*30))
            demoEvents.push({ id: `d-${ri}-${i}-${sh}-on`,  timestamp: on_t.toISOString(),  event_type: 'Motion Detected',  status: 'on',  duration: '—' })
            demoEvents.push({ id: `d-${ri}-${i}-${sh}-off`, timestamp: off_t.toISOString(), event_type: 'Lights Auto-OFF', status: 'off', duration: '7s timeout' })
          }
        })
      }
      demoEvents.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
      return {
        id: ri+1, name, description: ['CCS Lab 1 — Ground Floor','CCS Lab 2 — Ground Floor','CCS Lecture Room — 2nd Floor'][ri],
        is_active: false, occupancy: false,
        energy_saved_today: parseFloat(demoLogs[demoLogs.length-1].energy_saved),
        last_motion: demoEvents[0]?.timestamp, events: demoEvents, energy_logs: demoLogs
      }
    })
    setRooms(allRooms)
    setDemoMode(true)
    localStorage.setItem('sec_demo', 'true')
    addToast('Demo mode — simulated data for 3 rooms loaded', 'info')
  }

  const exitDemo = () => {
    setDemoMode(false); localStorage.removeItem('sec_demo')
    setRooms([]); setInitialLoading(true); loadRooms()
    addToast('Exited demo — connecting to ESP32', 'success')
  }

  const loadRooms = useCallback(async (silent = false) => {
    if (demoMode) return
    try {
      const data = await fetchRooms()
      setRooms(prev => {
        data.forEach(newRoom => {
          const prevCount = prevEventCounts.current[newRoom.name] || 0
          const newCount  = newRoom.events?.length || 0

          if (silent && newCount > prevCount) {
            const newIds = new Set(
              newRoom.events
                .slice(0, newCount - prevCount)
                .map(e => e.id)
            )
            setNewEventIds(newIds)
            setTimeout(() => setNewEventIds(new Set()), 2000)

            setActiveNav('dashboard')
            setSelectedRoom(newRoom.name)
            setViewingDate(null)
            setHistoricalData(null)

            addToast(`Motion detected in Room ${newRoom.name}!`, 'success')
            pushNotification(
              `Motion — Room ${newRoom.name}`,
              `Lights turned ON at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
              'motion',
              newRoom.name
            )
          }

          prevEventCounts.current[newRoom.name] = newCount
        })

        return data
      })
      if (data.length > 0 && !selectedRoom) setSelectedRoom(data[0].name)
    } catch {}
    finally { setInitialLoading(false) }
  }, [selectedRoom, demoMode, pushNotification])

  useEffect(() => { loadRooms() }, [])
  useEffect(() => {
    pollRef.current = setInterval(() => { if (!viewingDate && !demoMode) loadRooms(true) }, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [viewingDate, demoMode, loadRooms])
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '  |  ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    }
    tick(); intervalRef.current = setInterval(tick, 1000); return () => clearInterval(intervalRef.current)
  }, [])

  const handleSimulate = async () => {
    setSimulating(true)
    try {
      await simulateMotion(selectedRoom); await loadRooms(); setViewingDate(null)
      addToast('Lights ON — motion simulated!', 'success')
      pushNotification(`Motion — Room ${selectedRoom}`, `Simulated motion detected at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, 'motion', selectedRoom)
    } catch { addToast('Simulation failed', 'warning') }
    finally { setSimulating(false) }
  }

  const handleSimulateOff = async () => {
    setSimulatingOff(true)
    try { await simulateLightsOff(selectedRoom); await loadRooms(); addToast('Lights OFF — simulated!', 'info') }
    catch { addToast('Simulation failed', 'warning') }
    finally { setSimulatingOff(false) }
  }

  const handleDateChange = async (date) => {
    setSelectedDate(date); setShowCalendar(false)
    const today = new Date(); today.setHours(0,0,0,0)
    const sel   = new Date(date); sel.setHours(0,0,0,0)
    if (sel > today) { setViewingDate('future'); setHistoricalData(null); return }
    if (sel.getTime() === today.getTime()) { setViewingDate(null); setHistoricalData(null); return }
    setHistoryLoading(true); setHistoricalData(null); setViewingDate('past')
    try { const data = await fetchRoomHistory(selectedRoom, date.getFullYear(), date.getMonth()+1, date.getDate()); setHistoricalData(data) }
    catch { setHistoricalData({ events: [], energy_logs: [], occupancy: false, energy_saved_today: 0 }) }
    finally { setHistoryLoading(false) }
  }

  const saveInsight   = (insight) => { const entry = { ...insight, id: Date.now(), room: selectedRoom, date: new Date().toISOString() }; const updated = [entry, ...savedInsights]; setSavedInsights(updated); localStorage.setItem('sec_saved_insights', JSON.stringify(updated)); addToast('Insight saved', 'success') }
  const deleteInsight = (id) => { const updated = savedInsights.filter(s => s.id !== id); setSavedInsights(updated); localStorage.setItem('sec_saved_insights', JSON.stringify(updated)); addToast('Insight deleted', 'info') }

  const currentRoom = rooms.find(r => r.name === selectedRoom)
  let displayRoom = currentRoom; let isEmpty = true; let isFuture = false
  if (viewingDate === 'future') isFuture = true
  else if (viewingDate === 'past' && historicalData) { displayRoom = { ...currentRoom, ...historicalData }; isEmpty = !historicalData.events?.length }
  else isEmpty = !currentRoom?.events?.length

  const weekDays     = (() => { const d = []; const b = viewingDate === 'past' && selectedDate ? new Date(selectedDate) : new Date(); for (let i = 6; i >= 0; i--) { const dd = new Date(b); dd.setDate(dd.getDate()-i); d.push(dd.toLocaleDateString('en-US', { weekday: 'short' })) } return d })()
  const energyHours  = displayRoom?.energy_logs?.slice(-7).map(l => l.hours_on)     || [1.2,2.5,3.1,2.0,1.8,0.5,2.2]
  const energySavedW = displayRoom?.energy_logs?.slice(-7).map(l => l.energy_saved) || [0.15,0.18,0.22,0.20,0.17,0.12,0.19]

  const chartOptions = { responsive: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0e1a14', borderColor: 'rgba(0,200,150,0.2)', borderWidth: 1, titleColor: '#fff', bodyColor: '#8fa898' } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } } } }

  const navGroups = [
    { label: 'Monitor',  items: [{ key: 'dashboard', label: 'Dashboard', icon: '⊞' }, { key: 'rooms', label: 'Rooms', icon: '⌂' }, { key: 'logs', label: 'Event Logs', icon: '≡' }] },
    { label: 'Analyze',  items: [{ key: 'report', label: 'Reports', icon: '▦' }, { key: 'multiroom', label: 'Multi-Room', icon: '⊟' }, { key: 'insights', label: 'Smart Insights', icon: '★' }, { key: 'timeline', label: 'Timeline', icon: '◄' }] },
    { label: 'Control',  items: [{ key: 'automation', label: 'Automation', icon: '◎' }, { key: 'simulation', label: 'Simulation', icon: '▶' }] },
    { label: 'System',   items: [{ key: 'device', label: 'ESP32 Device', icon: '◎' }, { key: 'classroom3d', label: '3D Classroom', icon: '◈' }, { key: 'settings', label: 'Settings', icon: '⚙' }, { key: 'about', label: 'About', icon: 'ℹ' }] },
  ]

  const pageTitles = { dashboard: 'Dashboard', rooms: 'Rooms', logs: 'Event Logs', report: 'Reports', device: 'ESP32 Device', classroom3d: '3D Classroom', insights: 'Smart Insights', automation: 'Automation', simulation: 'Simulation', timeline: 'Timeline', multiroom: 'Multi-Room', settings: 'Settings', about: 'About' }

  if (initialLoading && !demoMode) return <PlexusLoader />

  return (
    <div className="dashboard-screen">
      <Toast toasts={toasts} />
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <div className="sidebar-brand">
          <span className="brand-sec">SEC</span>
          <span className="brand-label">Smart Environment<br />Classroom</span>
        </div>
        <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 2 }}>
              <div style={{ fontSize: '0.59rem', fontWeight: 600, color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 13px 3px' }}>{group.label}</div>
              {group.items.map(item => (
                <button key={item.key} className={`nav-link ${activeNav === item.key ? 'active' : ''}`} onClick={() => { setActiveNav(item.key); setSidebarOpen(false) }}>
                  <span style={{ marginRight: 8, fontSize: '0.85rem' }}>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 10px 8px', flexShrink: 0 }}>
          {currentUser && (
            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                  {(currentUser.first_name?.[0] || currentUser.username?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser.first_name || currentUser.username}
                  </div>
                  <RoleBadge role={userRole} />
                </div>
              </div>
            </div>
          )}
          <div style={{ padding: '10px 12px', background: demoMode ? 'rgba(0,200,150,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${demoMode ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.08)'}`, marginBottom: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: 6, fontWeight: 500 }}>{demoMode ? '● Demo Mode Active' : 'No ESP32 Connected?'}</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.22)', marginBottom: 8, lineHeight: 1.5 }}>{demoMode ? 'Simulated data. Exit to connect hardware.' : 'Try demo to explore the dashboard.'}</div>
            {demoMode
              ? <button onClick={exitDemo} style={{ width: '100%', padding: '7px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 7, fontFamily: 'Geist, sans-serif', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>Exit Demo</button>
              : <button onClick={generateDemoData} style={{ width: '100%', padding: '7px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, fontFamily: 'Geist, sans-serif', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>Try Demo</button>}
          </div>
        </div>

        <button className="sidebar-logout" onClick={onLogout} style={{ flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 7 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </aside>

      <div className="shell">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <h1 className="topbar-title">{pageTitles[activeNav]}</h1>
            {demoMode && <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: 'rgba(0,200,150,0.12)', color: 'var(--green)', border: '1px solid rgba(0,200,150,0.25)' }}>DEMO</span>}
          </div>
          <div className="topbar-meta">
            <span className="topbar-clock">{clock}</span>
            <NotificationBell notifications={notifications} onNavigate={handleNotifNav} onDelete={deleteNotif} onClearAll={clearAllNotifs} onMarkAllRead={markAllRead} />
            <button className="calendar-trigger-btn" onClick={() => setShowCalendar(!showCalendar)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
            <select className="room-select" value={selectedRoom} onChange={e => { setSelectedRoom(e.target.value); setViewingDate(null); setHistoricalData(null) }}>
              {rooms.map(room => <option key={room.id} value={room.name}>Room {room.name}</option>)}
            </select>
          </div>
        </header>

        <AnimatePresence>{showCalendar && (<motion.div className="calendar-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCalendar(false)} />)}</AnimatePresence>
        <AnimatePresence>{showCalendar && (<motion.div className="calendar-popup" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><Calendar onChange={handleDateChange} value={selectedDate} /></motion.div>)}</AnimatePresence>
        {viewingDate === 'past' && selectedDate && (
          <motion.div className="date-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <span>Viewing: <strong>{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span>
            <button onClick={() => { setViewingDate(null); setHistoricalData(null); setSelectedDate(new Date()) }}>Back to Today</button>
          </motion.div>
        )}

        <main className="dashboard-main">
          {activeNav === 'logs'        && <EventLogsPage rooms={rooms} setActiveNav={setActiveNav} />}
          {activeNav === 'rooms'       && <RoomsPage rooms={rooms} setRooms={setRooms} setSelectedRoom={setSelectedRoom} setActiveNav={setActiveNav} addToast={addToast} demoMode={demoMode} userRole={userRole} />}
          {activeNav === 'timeline'    && <TimelinePage rooms={rooms} selectedRoom={selectedRoom} />}
          {activeNav === 'automation'  && <AutomationPage rooms={rooms} addToast={addToast} demoMode={demoMode} userRole={userRole} />}
          {activeNav === 'report'      && <ReportPage rooms={rooms} selectedRoom={selectedRoom} />}
          {activeNav === 'multiroom'   && <MultiRoomPlaceholder rooms={rooms} />}
          {activeNav === 'insights'    && <InsightsPlaceholder rooms={rooms} selectedRoom={selectedRoom} savedInsights={savedInsights} onSaveInsight={saveInsight} onDeleteInsight={deleteInsight} />}
          {activeNav === 'simulation'  && <SimulationPlaceholder rooms={rooms} selectedRoom={selectedRoom} loadRooms={loadRooms} addToast={addToast} />}
          {activeNav === 'device'      && <DevicePlaceholder currentRoom={currentRoom} />}
          {activeNav === 'settings'    && <SettingsPlaceholder userRole={userRole} />}
          {activeNav === 'about'       && <AboutPlaceholder />}
          {activeNav === 'classroom3d' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ height: 'calc(100vh - var(--topbar-h) - 64px)', display: 'flex', flexDirection: 'column' }}>
              <Classroom3DPage />
            </motion.div>
          )}

          {activeNav === 'dashboard' && (
            historyLoading ? (
              <div className="loading-state"><div className="dot-loader"><span /><span /><span /></div><p>Loading history…</p></div>
            ) : isFuture ? (
              <div className="empty-state"><div className="empty-ring"><div className="empty-pulse" /></div><p className="empty-title">Cannot Predict the Future</p><p className="empty-body">No data for future dates.</p></div>
            ) : !displayRoom?.events?.length && !viewingDate ? (
              <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="empty-ring"><div className="empty-pulse" /></div>
                <p className="empty-title">Awaiting Motion Detection</p>
                <p className="empty-body">No activity yet. Simulate motion or connect your ESP32.</p>
                <div className="sim-btns">
                  <button className="simulate-btn" onClick={handleSimulate} disabled={simulating}>{simulating ? 'Simulating…' : '⚡ Simulate Lights ON'}</button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="view-toggle-bar">
                  {['day','week','month','year'].map(v => <button key={v} className={viewMode === v ? 'active' : ''} onClick={() => setViewMode(v)}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>)}
                </div>
                <div className="stat-grid">
                  {[
                    { label: 'Light Status', val: displayRoom?.is_active ? 'ON' : 'OFF', type: 'light' },
                    { label: 'Last Motion', val: displayRoom?.last_motion ? new Date(displayRoom.last_motion).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—', type: 'motion' },
                    { label: 'Room Occupancy', val: displayRoom?.occupancy ? 'Occupied' : 'Vacant', type: 'occupancy' },
                    { label: 'Energy Saved Today', val: `${(displayRoom?.energy_saved_today || 0).toFixed(2)} kWh`, type: 'energy' },
                  ].map((s, i) => (
                    <div key={i} className="stat-card" onClick={() => { setModalData({ type: s.type, room: displayRoom }); setModalOpen(s.type) }} style={{ cursor: 'pointer' }}>
                      <div className="stat-label">{s.label}</div>
                      <div className="stat-value" style={{ fontSize: i > 1 ? '1.3rem' : '1.7rem' }}>{s.val}</div>
                      {i === 0 && <StatusBadge on={displayRoom?.is_active} />}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 8 }}>Click for details</div>
                    </div>
                  ))}
                </div>
                <div className="charts-row">
                  <div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Daily Light Usage</span><span className="chart-panel-sub">Hours lights were on this week</span></div><Bar data={{ labels: weekDays, datasets: [{ label: 'Hours', data: energyHours, backgroundColor: 'rgba(0,200,150,0.18)', borderColor: 'rgba(0,200,150,0.75)', borderWidth: 1.5, borderRadius: 7 }] }} options={chartOptions} /></div>
                  <div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Energy Saved</span><span className="chart-panel-sub">kWh saved vs. baseline this week</span></div><Line data={{ labels: weekDays, datasets: [{ label: 'kWh Saved', data: energySavedW, borderColor: 'rgba(0,200,150,0.85)', backgroundColor: 'rgba(0,200,150,0.07)', borderWidth: 2, tension: 0.45, pointBackgroundColor: 'var(--green)', pointRadius: 4, fill: true }] }} options={chartOptions} /></div>
                </div>
                <div className="log-panel">
                  <div className="log-panel-head">
                    <span className="chart-panel-title">Event Log — Room {selectedRoom}</span>
                    <span className="live-badge"><span className="live-dot" />Live · {POLL_INTERVAL/1000}s</span>
                  </div>
                  <div className="table-scroll">
                    <table className="log-table">
                      <thead><tr><th>Time</th><th>Period</th><th>Event</th><th>Room</th><th>Duration</th><th>Status</th></tr></thead>
                      <tbody>
                        {(displayRoom?.events || []).slice(0, 20).map((ev, i) => {
                          const pk = getEventPeriodKey(ev.timestamp)
                          return (
                            <tr key={i} className={newEventIds.has(ev.id) || i === 0 ? 'new-row' : ''}>
                              <td>{new Date(ev.timestamp).toLocaleTimeString()}</td>
                              <td><span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: `${PERIOD_COLORS[pk]}18`, color: PERIOD_COLORS[pk] }}>{CLASS_PERIODS.find(p => p.key === pk)?.label?.split(' ')[0]}</span></td>
                              <td>{ev.event_type}</td>
                              <td>Room {displayRoom.name}</td>
                              <td>{ev.duration}</td>
                              <td><span className={`status-tag ${ev.status}`}>{ev.status === 'on' ? 'Active' : 'Ended'}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {!viewingDate && (
                  <div className="sim-btns" style={{ marginTop: 18 }}>
                    <button className="simulate-btn" onClick={handleSimulate} disabled={simulating}>{simulating ? 'Simulating…' : '⚡ Simulate Lights ON'}</button>
                    <button className="simulate-btn sim-off" onClick={handleSimulateOff} disabled={simulatingOff}>{simulatingOff ? 'Turning off…' : '🌑 Simulate Lights OFF'}</button>
                  </div>
                )}
              </motion.div>
            )
          )}
        </main>
      </div>

      <AnimatePresence>
        {modalOpen && modalData && (
          <ModalWrap title={modalOpen==='light' ? `Light Control — Room ${selectedRoom}` : modalOpen==='motion' ? `Motion History — Room ${selectedRoom}` : modalOpen==='occupancy' ? `Occupancy — Room ${selectedRoom}` : `Energy — Room ${selectedRoom}`} onClose={() => { setModalOpen(null); setModalData(null) }}>
            {modalOpen === 'light' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: modalData.room?.is_active ? 'rgba(0,200,150,0.08)' : 'rgba(239,68,68,0.06)', borderRadius: 10, border: `1px solid ${modalData.room?.is_active ? 'rgba(0,200,150,0.25)' : 'rgba(239,68,68,0.2)'}` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: modalData.room?.is_active ? 'var(--green)' : 'var(--red)', animation: modalData.room?.is_active ? 'livePulse 1.8s infinite' : 'none' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>Lights are <strong style={{ color: modalData.room?.is_active ? 'var(--green)' : 'var(--red)' }}>{modalData.room?.is_active ? 'ON' : 'OFF'}</strong></span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.7 }}>The relay module on GPIO 26 controls the 2.5V bulb. PIR sensor on GPIO 14 triggers motion events. Auto-off activates after 7 seconds of no motion.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleSimulate} disabled={simulating} style={{ flex: 1, padding: '10px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', fontWeight: 500, cursor: 'pointer' }}>{simulating ? '…' : 'Turn ON'}</button>
                  <button onClick={handleSimulateOff} disabled={simulatingOff} style={{ flex: 1, padding: '10px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', fontWeight: 500, cursor: 'pointer' }}>{simulatingOff ? '…' : 'Turn OFF'}</button>
                </div>
              </div>
            )}
            {modalOpen === 'motion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.7 }}>HC-SR501 PIR sensor outputs HIGH (3.3V) to GPIO 14 when motion is sensed, triggering the relay and logging the event.</p>
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(modalData.room?.events || []).filter(e => e.status === 'on').slice(0, 12).map((ev, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: '0.81rem' }}>
                      <span style={{ color: 'var(--text-3)' }}>{new Date(ev.timestamp).toLocaleString()}</span>
                      <span style={{ color: 'var(--green)', fontWeight: 500 }}>{ev.event_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {modalOpen === 'occupancy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 5 }}>Current</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 600, color: modalData.room?.occupancy ? 'var(--green)' : 'var(--text-1)' }}>{modalData.room?.occupancy ? 'Occupied' : 'Vacant'}</div>
                  </div>
                  <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 5 }}>Total Detections</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-1)' }}>{(modalData.room?.events || []).filter(e => e.status === 'on').length}</div>
                  </div>
                </div>
              </div>
            )}
            {modalOpen === 'energy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 5 }}>Saved Today</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--green)' }}>{(modalData.room?.energy_saved_today || 0).toFixed(3)} kWh</div>
                  </div>
                  <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 5 }}>Peso Value</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#f59e0b' }}>₱{((modalData.room?.energy_saved_today || 0) * ZAMCELCO_RATE).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}
          </ModalWrap>
        )}
      </AnimatePresence>
    </div>
  )
}
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement } from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Text } from '@react-three/drei'
import * as THREE from 'three'
import { fetchRooms, simulateMotion, simulateLightsOff, fetchRoomHistory } from '../api'
import PlexusLoader from './PlexusLoader'
import Classroom3DPage from './Classroom3DPage'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement)

const POLL_INTERVAL = 5000
const ZAMCELCO_RATE = 13.25

function StatusBadge({ on }) {
  return <span className={`stat-pill ${on ? 'pill-on' : 'pill-off'}`}>{on ? 'Active' : 'Inactive'}</span>
}

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} className={`toast toast-${t.type}`} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}>
            <span className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'warning' ? '⚠' : 'ℹ'}</span>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Modal({ title, children, onClose }) {
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

function Wire({ start, end, color = '#00c896', animated = false }) {
  const ref = useRef()
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)]
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
  useFrame(({ clock }) => {
    if (animated && ref.current) {
      ref.current.material.opacity = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3)
    }
  })
  return (
    <line ref={ref} geometry={lineGeometry}>
      <lineBasicMaterial color={color} transparent opacity={animated ? 0.8 : 1} linewidth={2} />
    </line>
  )
}

function ESP32Model({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[2.2, 0.12, 1.1]} />
        <meshStandardMaterial color="#1a5c22" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0.55, 0.12, 0]}>
        <boxGeometry args={[0.7, 0.18, 0.5]} />
        <meshStandardMaterial color="#c87820" roughness={0.3} metalness={0.6} />
      </mesh>
      {[-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9].map((x, i) => (
        <mesh key={i} position={[x, -0.1, -0.58]}>
          <boxGeometry args={[0.08, 0.15, 0.08]} />
          <meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {[-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9].map((x, i) => (
        <mesh key={i} position={[x, -0.1, 0.58]}>
          <boxGeometry args={[0.08, 0.15, 0.08]} />
          <meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      <mesh position={[-0.3, 0.12, -0.3]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, 0.5, 0]} intensity={0.6} color="#00ff88" distance={2} />
      <Html position={[0, 0.5, 0]} center>
        <div style={{ background: 'rgba(0,15,5,0.9)', color: '#00ff88', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(0,255,136,0.4)' }}>ESP32</div>
      </Html>
    </group>
  )
}

function PIRModel({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.8, 0.1, 0.8]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#f0e8c8" transparent opacity={0.85} roughness={0.1} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#cc4444" emissive="#cc2222" emissiveIntensity={0.4} roughness={0.2} />
      </mesh>
      {[[-0.25, -0.08, 0], [0, -0.08, 0], [0.25, -0.08, 0]].map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.05, 0.2, 0.05]} />
          <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <Html position={[0, 0.8, 0]} center>
        <div style={{ background: 'rgba(15,0,0,0.9)', color: '#ff6666', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(255,100,100,0.4)' }}>PIR Sensor</div>
      </Html>
    </group>
  )
}

function RelayModel({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.4, 0.1, 0.8]} />
        <meshStandardMaterial color="#0a3a7a" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0.2, 0.18, 0]}>
        <boxGeometry args={[0.5, 0.22, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[-0.4, 0.12, 0]}>
        <boxGeometry args={[0.35, 0.18, 0.6]} />
        <meshStandardMaterial color="#1a7a3a" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0.55, 0.18, 0.2]}>
        <sphereGeometry args={[0.065, 8, 8]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.55, 0.18, -0.2]}>
        <sphereGeometry args={[0.065, 8, 8]} />
        <meshStandardMaterial color="#22ff22" emissive="#22ff22" emissiveIntensity={1.5} />
      </mesh>
      <Html position={[0, 0.6, 0]} center>
        <div style={{ background: 'rgba(0,0,20,0.9)', color: '#4488ff', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(68,136,255,0.4)' }}>Relay Module</div>
      </Html>
    </group>
  )
}

function BulbModel({ position, isOn = false }) {
  const glowRef = useRef()
  useFrame(({ clock }) => {
    if (glowRef.current && isOn) {
      glowRef.current.intensity = 1.5 + 0.3 * Math.sin(clock.elapsedTime * 2)
    }
  })
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.3, 12]} />
        <meshStandardMaterial color="#888" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={isOn ? '#fff9c4' : '#d0d0d0'} transparent opacity={0.9} emissive={isOn ? '#ffeb3b' : '#000'} emissiveIntensity={isOn ? 1.5 : 0} roughness={0.1} />
      </mesh>
      {isOn && <pointLight ref={glowRef} position={[0, 0.6, 0]} intensity={1.5} color="#fffde7" distance={4} />}
      <Html position={[0, 1.1, 0]} center>
        <div style={{ background: isOn ? 'rgba(30,20,0,0.9)' : 'rgba(10,10,10,0.9)', color: isOn ? '#ffd700' : '#aaa', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'nowrap', border: `1px solid ${isOn ? 'rgba(255,215,0,0.4)' : 'rgba(150,150,150,0.3)'}` }}>{isOn ? '💡 ON' : 'Bulb (2.5V)'}</div>
      </Html>
    </group>
  )
}

function BatteryModel({ position }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.4, 0.4, 1.2, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 12]} />
        <meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.5, 16]} />
        <meshStandardMaterial color="#cc2200" roughness={0.6} />
      </mesh>
      <Html position={[0, 1.1, 0]} center>
        <div style={{ background: 'rgba(10,0,0,0.9)', color: '#ff6644', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(255,100,68,0.4)' }}>9V Battery</div>
      </Html>
    </group>
  )
}

function BreadboardModel({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[2.5, 0.08, 1.0]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.7} />
      </mesh>
      {[-0.08, 0.08].map((z, i) => (
        <mesh key={i} position={[0, 0.05, z * 3.5]}>
          <boxGeometry args={[2.45, 0.03, 0.06]} />
          <meshStandardMaterial color={i === 0 ? '#cc4444' : '#4444cc'} roughness={0.5} />
        </mesh>
      ))}
      {[-1.0, -0.6, -0.2, 0.2, 0.6, 1.0].map((x, i) =>
        [-0.2, -0.1, 0, 0.1, 0.2].map((z, j) => (
          <mesh key={`${i}-${j}`} position={[x, 0.05, z]}>
            <boxGeometry args={[0.04, 0.04, 0.04]} />
            <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
          </mesh>
        ))
      )}
      <Html position={[0, 0.4, 0]} center>
        <div style={{ background: 'rgba(10,10,10,0.9)', color: '#ccc', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(200,200,200,0.2)' }}>Breadboard</div>
      </Html>
    </group>
  )
}

function ResistorModel({ position }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.07, 0.07, 0.5, 10]} />
        <meshStandardMaterial color="#c8a864" roughness={0.6} />
      </mesh>
      {[[-0.1, 0], [0, 0], [0.1, 0]].map((p, i) => (
        <mesh key={i} position={[0, p[0] * 2, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.02, 10]} />
          <meshStandardMaterial color={['#c84040', '#8040c8', '#c8a020'][i]} />
        </mesh>
      ))}
      {[-1, 1].map((s, i) => (
        <mesh key={i} position={[0, s * 0.35, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
          <meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      <Html position={[0.5, 0, 0]} center>
        <div style={{ background: 'rgba(10,10,0,0.9)', color: '#ffd700', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(255,215,0,0.3)' }}>Resistor</div>
      </Html>
    </group>
  )
}

function WiringScene({ showMotion }) {
  return (
    <>
      <ambientLight intensity={0.6} color="#fff5e8" />
      <directionalLight position={[5, 8, 5]} intensity={0.8} color="#fff8e0" castShadow />
      <pointLight position={[-5, 5, -3]} intensity={0.4} color="#88ccff" distance={15} />
      <ESP32Model position={[0, 0, 0]} />
      <PIRModel position={[-4.5, 0, -2]} />
      <RelayModel position={[3.5, 0, -1.5]} />
      <BulbModel position={[3.5, 0, 1.5]} isOn={showMotion} />
      <BatteryModel position={[5.5, 0, 1.5]} />
      <BreadboardModel position={[0, 0, 2.2]} />
      <ResistorModel position={[0, 0.3, 1.6]} />
      <Wire start={[-4.5, 0.1, -1.6]} end={[-0.9, 0.1, -0.55]} color="#ff4444" animated={showMotion} />
      <Wire start={[-4.5, 0.1, -2.4]} end={[-0.5, 0.1, -0.55]} color="#222222" />
      <Wire start={[-4.5, 0.1, -1.8]} end={[-0.7, 0.1, -0.55]} color="#00c896" animated={showMotion} />
      <Wire start={[0.9, 0.1, -0.55]} end={[2.1, 0.1, -1.5]} color="#4488ff" animated={showMotion} />
      <Wire start={[1.1, 0.1, -0.55]} end={[2.1, 0.1, -1.8]} color="#222222" />
      <Wire start={[0.7, 0.1, -0.55]} end={[2.1, 0.1, -1.2]} color="#ff4444" />
      <Wire start={[4.9, 0.1, -1.5]} end={[5.1, 0.1, 1.0]} color="#ff6600" animated={showMotion} />
      <Wire start={[5.5, 0.55, 1.5]} end={[5.3, 0.1, 1.0]} color="#ff4444" />
      <Wire start={[3.5, 0.55, 1.5]} end={[4.9, 0.1, -1.2]} color="#ff8844" animated={showMotion} />
      <Wire start={[0, 0.1, 0.55]} end={[0, 0.1, 1.7]} color="#00c896" />
      <Wire start={[0.3, 0.1, 0.55]} end={[0.3, 0.1, 1.7]} color="#222222" />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={4} maxDistance={20} />
    </>
  )
}

function ESP32WiringModel({ showMotion }) {
  return (
    <div style={{ width: '100%', height: 400, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#08100c' }}>
      <Canvas camera={{ position: [6, 6, 8], fov: 55 }} shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
        <Suspense fallback={null}>
          <WiringScene showMotion={showMotion} />
        </Suspense>
      </Canvas>
    </div>
  )
}

function SmartInsightsPage({ rooms, selectedRoom, savedInsights, onSaveInsight, onDeleteInsight }) {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSaved, setShowSaved] = useState(false)
  const room = rooms.find(r => r.name === selectedRoom)

  const generateInsights = () => {
    setLoading(true)
    setError(null)
    setTimeout(() => {
      try {
        const energyLogs = room?.energy_logs?.slice(-7) || []
        const events = room?.events?.slice(0, 30) || []
        const energySaved = room?.energy_saved_today || 0
        const hoursOn = energyLogs.reduce((a, b) => a + (b.hours_on || 0), 0)
        const onEvents = events.filter(e => e.status === 'on').length
        const totalEvents = events.length
        const occupancyRate = totalEvents > 0 ? Math.round((onEvents / totalEvents) * 100) : 0
        const avgHours = energyLogs.length > 0 ? (hoursOn / energyLogs.length).toFixed(1) : 0
        const maxHours = energyLogs.length > 0 ? Math.max(...energyLogs.map(l => l.hours_on || 0)) : 0
        const minHours = energyLogs.length > 0 ? Math.min(...energyLogs.map(l => l.hours_on || 0)) : 0
        const totalSaved = energyLogs.reduce((a, b) => a + (b.energy_saved || 0), 0)
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        const peakDay = energyLogs.length > 0 ? energyLogs.reduce((a, b) => (a.hours_on || 0) > (b.hours_on || 0) ? a : b) : null
        const generatedInsights = []
        if (energySaved < 0.3 && hoursOn > 15) {
          generatedInsights.push({ type: 'warning', title: 'Critical Energy Waste Detected', body: `Room ${selectedRoom} consumed ${hoursOn.toFixed(1)} hours this week but saved only ${energySaved.toFixed(3)} kWh today.`, saving: `~₱${(hoursOn * 0.12 * ZAMCELCO_RATE).toFixed(2)}/week`, action: 'Reduce timeout to 5 minutes' })
        } else if (energySaved > 1.0) {
          generatedInsights.push({ type: 'success', title: 'Excellent Energy Performance', body: `Room ${selectedRoom} saved ${energySaved.toFixed(3)} kWh today.`, saving: `₱${(energySaved * ZAMCELCO_RATE).toFixed(2)} saved today`, action: 'Maintain current settings' })
        } else {
          generatedInsights.push({ type: 'info', title: 'Moderate Energy Usage', body: `Room ${selectedRoom} shows ${energySaved.toFixed(3)} kWh saved today.`, saving: `₱${(energySaved * ZAMCELCO_RATE).toFixed(2)} saved`, action: 'Monitor for 3 more days' })
        }
        if (occupancyRate < 20 && totalEvents > 3) {
          generatedInsights.push({ type: 'warning', title: 'Sensor Sensitivity Issue', body: `Only ${occupancyRate}% occupancy rate with ${totalEvents} events.`, saving: '~20% more accurate detection possible', action: 'Reposition sensor toward seating area' })
        } else if (occupancyRate > 75) {
          generatedInsights.push({ type: 'success', title: 'High Classroom Utilization', body: `${occupancyRate}% occupancy rate on ${today}.`, saving: 'Optimal classroom usage pattern', action: 'No action needed' })
        } else {
          generatedInsights.push({ type: 'tip', title: 'Balanced Occupancy Pattern', body: `At ${occupancyRate}% occupancy, Room ${selectedRoom} has a healthy mix.`, saving: 'Efficiency maintained', action: 'Continue monitoring' })
        }
        if (maxHours > 8) {
          generatedInsights.push({ type: 'warning', title: 'Extended Light Usage Alert', body: `Peak usage of ${maxHours} hours on ${peakDay?.date || 'one day'}.`, saving: `~₱${((maxHours - 6) * ZAMCELCO_RATE * 0.09).toFixed(2)}/day`, action: 'Check relay connections' })
        } else if (avgHours < 2) {
          generatedInsights.push({ type: 'info', title: 'Minimal Light Usage', body: `Averaging only ${avgHours} hours daily.`, saving: 'Low consumption baseline', action: 'Verify room schedule' })
        } else {
          generatedInsights.push({ type: 'success', title: 'Healthy Daily Light Average', body: `At ${avgHours} hours per day.`, saving: 'Within expected parameters', action: 'No changes needed' })
        }
        const lastEvent = events[0]
        if (lastEvent && lastEvent.status === 'on' && room?.occupancy === false) {
          generatedInsights.push({ type: 'warning', title: 'Lights On While Vacant', body: `Latest event shows lights ON but room is vacant.`, saving: `~₱${(0.5 * ZAMCELCO_RATE).toFixed(2)}/day`, action: 'Verify GPIO 2 output' })
        } else if (lastEvent && lastEvent.status === 'off') {
          generatedInsights.push({ type: 'success', title: 'Auto-Off Working Correctly', body: `Last event shows lights turned OFF successfully.`, saving: 'System operational', action: 'No action needed' })
        }
        if (totalSaved > 2.0) {
          generatedInsights.push({ type: 'success', title: 'Weekly Savings Milestone', body: `Total savings of ${totalSaved.toFixed(3)} kWh this week.`, saving: `₱${(totalSaved * ZAMCELCO_RATE).toFixed(2)} this week`, action: 'Track monthly trend' })
        }
        setInsights(generatedInsights.slice(0, 4))
      } catch (e) {
        setError('Could not generate insights.')
      } finally {
        setLoading(false)
      }
    }, 1500)
  }

  const typeConfig = {
    success: { bg: 'rgba(0,200,150,0.08)', border: 'rgba(0,200,150,0.25)', icon: '✓', color: '#00c896' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '⚠', color: '#f59e0b' },
    info: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', icon: 'ℹ', color: '#6366f1' },
    tip: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', icon: '→', color: '#10b981' },
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Smart Insights — Room {selectedRoom}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>AI-powered energy analysis and optimization recommendations</p>
        </div>
        <button onClick={generateInsights} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--dark)', color: 'var(--green)', border: '1.5px solid rgba(0,200,150,0.3)', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, transition: 'all 0.18s' }}>
          {loading ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(0,200,150,0.3)', borderTop: '2px solid var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Analyzing…</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>Generate AI Insights</>}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[{ label: 'Energy Today', val: `${(room?.energy_saved_today || 0).toFixed(3)} kWh`, color: '#00c896' },{ label: 'Peso Savings', val: `₱${((room?.energy_saved_today || 0) * ZAMCELCO_RATE).toFixed(2)}`, color: '#f59e0b' },{ label: 'Light Status', val: room?.is_active ? 'ON' : 'OFF', color: room?.is_active ? '#00c896' : '#ef4444' },{ label: 'Occupancy', val: room?.occupancy ? 'Occupied' : 'Vacant', color: room?.occupancy ? '#6366f1' : '#8fa898' }].map((s, i) => (<div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div><div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: s.color }}>{s.val}</div></div>))}
      </div>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', color: '#991b1b', fontSize: '0.85rem', marginBottom: 20 }}>{error}</div>}
      {insights.length === 0 && !loading && !error && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🧠</div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)', marginBottom: 8 }}>Ready to Analyze</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>Click "Generate AI Insights" to get personalized energy optimization recommendations based on your actual room data.</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => setShowSaved(false)} style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${!showSaved ? 'var(--green)' : 'var(--border)'}`, background: !showSaved ? 'var(--green-dim)' : 'var(--bg)', color: !showSaved ? 'var(--green)' : 'var(--text-3)', fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>Current Insights</button>
        <button onClick={() => setShowSaved(true)} style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${showSaved ? 'var(--green)' : 'var(--border)'}`, background: showSaved ? 'var(--green-dim)' : 'var(--bg)', color: showSaved ? 'var(--green)' : 'var(--text-3)', fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>Saved Insights ({savedInsights.length})</button>
      </div>
      {!showSaved && insights.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {insights.map((insight, i) => {
            const cfg = typeConfig[insight.type] || typeConfig.info
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, fontSize: '1rem', flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>{insight.title}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 10 }}>{insight.body}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'inline-block', background: cfg.border, borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, color: cfg.color }}>{insight.saving}</div>
                      {insight.action && <div style={{ display: 'inline-block', background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', color: 'var(--text-3)' }}>→ {insight.action}</div>}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${cfg.border}`, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => onSaveInsight(insight)} style={{ padding: '5px 12px', background: 'none', border: `1px solid ${cfg.border}`, borderRadius: 6, fontSize: '0.75rem', color: cfg.color, fontWeight: 500, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Save Insight</button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
      {showSaved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {savedInsights.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📌</div><div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.2rem', color: 'var(--text-1)', marginBottom: 6 }}>No Saved Insights</div><div style={{ fontSize: '0.85rem', color: 'var(--text-3)', lineHeight: 1.6 }}>Generate insights and click Save to store them here for future reference.</div></div>
          ) : (
            savedInsights.map((insight, i) => {
              const cfg = typeConfig[insight.type] || typeConfig.info
              return (
                <motion.div key={insight.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, fontSize: '1rem', flexShrink: 0 }}>{cfg.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}><div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-1)' }}>{insight.title}</div><span style={{ fontSize: '0.68rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(insight.date).toLocaleDateString()}</span></div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 8 }}>{insight.body}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><div style={{ display: 'inline-block', background: cfg.border, borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, color: cfg.color }}>{insight.saving}</div>{insight.action && <div style={{ display: 'inline-block', background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', color: 'var(--text-3)' }}>→ {insight.action}</div>}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${cfg.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Room {insight.room}</span><button onClick={() => onDeleteInsight(insight.id)} style={{ padding: '4px 10px', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: '0.72rem', color: 'var(--red)', fontWeight: 500, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Delete</button></div>
                </motion.div>
              )
            })
          )}
        </div>
      )}
    </motion.div>
  )
}

function AutomationPage({ addToast }) {
  const [rules, setRules] = useState(() => { try { return JSON.parse(localStorage.getItem('sec_rules') || '[]') } catch { return [] } })
  const [form, setForm] = useState({ name: '', trigger: 'no_motion', delay: 5, action: 'lights_off', room: 'A', enabled: true })
  const [adding, setAdding] = useState(false)
  const saveRules = (updated) => { setRules(updated); localStorage.setItem('sec_rules', JSON.stringify(updated)) }
  const addRule = () => { if (!form.name.trim()) return; const rule = { ...form, id: Date.now(), createdAt: new Date().toISOString() }; saveRules([...rules, rule]); setForm({ name: '', trigger: 'no_motion', delay: 5, action: 'lights_off', room: 'A', enabled: true }); setAdding(false); addToast('Automation rule created!', 'success') }
  const toggleRule = (id) => saveRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  const deleteRule = (id) => { saveRules(rules.filter(r => r.id !== id)); addToast('Rule deleted', 'info') }
  const triggerLabels = { no_motion: 'No motion detected', motion: 'Motion detected', lights_on: 'Lights turn ON', lights_off: 'Lights turn OFF', time_of_day: 'Time of day' }
  const actionLabels = { lights_off: 'Turn lights OFF', lights_on: 'Turn lights ON', notify: 'Send notification', log_event: 'Log event' }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}><div><h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Automation Rules</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Define smart triggers and actions for automatic light control</p></div><button onClick={() => setAdding(!adding)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: adding ? 'var(--bg)' : 'var(--dark)', color: adding ? 'var(--text-2)' : 'var(--green)', border: `1.5px solid ${adding ? 'var(--border)' : 'rgba(0,200,150,0.3)'}`, borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.83rem', fontWeight: 500, cursor: 'pointer' }}>{adding ? '✕ Cancel' : '+ Add Rule'}</button></div>
      <AnimatePresence>{adding && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ background: 'var(--surface)', border: '1px solid var(--green)', borderRadius: 12, padding: '24px', marginBottom: 20, overflow: 'hidden' }}><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 16 }}>New Automation Rule</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}><div><label style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Rule Name</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Auto lights off after class" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} /></div><div><label style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Room</label><select value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>{['A','B','C'].map(r => <option key={r}>Room {r}</option>)}</select></div><div><label style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Trigger (IF)</label><select value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>{Object.entries(triggerLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div><div><label style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Action (THEN)</label><select value={form.action} onChange={e => setForm(p => ({ ...p, action: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none' }}>{Object.entries(actionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div><div><label style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Delay (minutes)</label><input type="number" min={1} max={60} value={form.delay} onChange={e => setForm(p => ({ ...p, delay: parseInt(e.target.value) || 5 }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} /></div><div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={addRule} style={{ width: '100%', padding: '10px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>Save Rule</button></div></div><div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,200,150,0.06)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-1)' }}>Preview: </strong>IF <strong>{triggerLabels[form.trigger]}</strong> for <strong>{form.delay} min</strong> in <strong>Room {form.room}</strong> → THEN <strong>{actionLabels[form.action]}</strong></div></motion.div>)}</AnimatePresence>
      {rules.length === 0 ? (<div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}><div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚙️</div><div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)', marginBottom: 8 }}>No Rules Yet</div><div style={{ fontSize: '0.85rem', color: 'var(--text-3)', lineHeight: 1.7 }}>Create automation rules to automatically control lights based on motion, time, or occupancy.</div></div>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{rules.map((rule, i) => (<motion.div key={rule.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} style={{ background: 'var(--surface)', border: `1.5px solid ${rule.enabled ? 'rgba(0,200,150,0.2)' : 'var(--border)'}`, borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, opacity: rule.enabled ? 1 : 0.6 }}><div onClick={() => toggleRule(rule.id)} style={{ width: 38, height: 22, borderRadius: 11, cursor: 'pointer', flexShrink: 0, background: rule.enabled ? 'var(--green)' : 'var(--border)', position: 'relative', transition: 'background 0.2s' }}><div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: rule.enabled ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} /></div><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 4 }}>{rule.name}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>IF <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{triggerLabels[rule.trigger]}</span> for {rule.delay}m in Room {rule.room}{' → '}<span style={{ color: 'var(--green)', fontWeight: 500 }}>{actionLabels[rule.action]}</span></div></div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: rule.enabled ? 'rgba(0,200,150,0.1)' : 'rgba(0,0,0,0.05)', color: rule.enabled ? 'var(--green)' : 'var(--text-3)' }}>{rule.enabled ? 'Active' : 'Paused'}</span><button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', borderRadius: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></motion.div>))}</div>)}
    </motion.div>
  )
}

function SimulationPage({ rooms, selectedRoom, loadRooms, addToast }) {
  const [simulating, setSimulating] = useState(false)
  const [simulatingOff, setSimulatingOff] = useState(false)
  const [scenario, setScenario] = useState(null)
  const [scenarioRunning, setScenarioRunning] = useState(false)
  const [scenarioLog, setScenarioLog] = useState([])
  const [scenarioProgress, setScenarioProgress] = useState(0)
  const room = rooms.find(r => r.name === selectedRoom)
  const handleOn = async () => { setSimulating(true); try { await simulateMotion(selectedRoom); await loadRooms(); addToast('Lights ON — motion simulated!', 'success') } catch { addToast('Simulation failed', 'warning') } finally { setSimulating(false) } }
  const handleOff = async () => { setSimulatingOff(true); try { await simulateLightsOff(selectedRoom); await loadRooms(); addToast('Lights OFF — simulated!', 'info') } catch { addToast('Simulation failed', 'warning') } finally { setSimulatingOff(false) } }
  const scenarios = [{ id: 'morning', name: 'Morning Class', desc: 'Students arrive at 7AM, class runs 3 hours, then room clears.', steps: [{ label: 'Students arriving…', action: 'on', delay: 600 },{ label: 'Class in session', action: null, delay: 2000 },{ label: 'Break time', action: 'off', delay: 1000 },{ label: 'Class resumes', action: 'on', delay: 1500 },{ label: 'Class ends', action: 'off', delay: 800 }] },{ id: 'idle', name: 'Idle Detection', desc: 'Lights left on with no occupancy — tests auto-off behavior.', steps: [{ label: 'Lights turned ON', action: 'on', delay: 600 },{ label: 'No motion detected', action: null, delay: 2000 },{ label: 'Idle timeout triggered', action: null, delay: 1500 },{ label: 'Auto lights OFF', action: 'off', delay: 800 }] },{ id: 'busy', name: 'Busy Day', desc: 'Multiple classes back-to-back throughout the day.', steps: [{ label: 'First class ON', action: 'on', delay: 500 },{ label: 'Break', action: 'off', delay: 800 },{ label: 'Second class ON', action: 'on', delay: 500 },{ label: 'Lunch break', action: 'off', delay: 800 },{ label: 'Afternoon class', action: 'on', delay: 500 },{ label: 'Day ends', action: 'off', delay: 700 }] }]
  const runScenario = async (sc) => { setScenario(sc.id); setScenarioRunning(true); setScenarioLog([]); setScenarioProgress(0); const total = sc.steps.length; for (let i = 0; i < sc.steps.length; i++) { const step = sc.steps[i]; setScenarioLog(prev => [...prev, { label: step.label, time: new Date().toLocaleTimeString(), status: 'running' }]); setScenarioProgress(Math.round(((i + 1) / total) * 100)); if (step.action === 'on') { try { await simulateMotion(selectedRoom); await loadRooms() } catch {} } if (step.action === 'off') { try { await simulateLightsOff(selectedRoom); await loadRooms() } catch {} } await new Promise(r => setTimeout(r, step.delay)); setScenarioLog(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s)) } setScenarioRunning(false); addToast(`Scenario "${sc.name}" complete!`, 'success') }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 24 }}><h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Simulation Mode</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Test your system behavior without physical hardware</p></div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', marginBottom: 20 }}><div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 4 }}>Manual Controls — Room {selectedRoom}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: 20 }}>Instantly trigger motion ON or lights OFF for the selected room.</div><div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><button onClick={handleOn} disabled={simulating || scenarioRunning} style={{ padding: '11px 28px', background: 'none', border: '1.5px solid var(--green)', borderRadius: 9, color: 'var(--green)', fontFamily: 'Geist, sans-serif', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.18s' }} onMouseEnter={e => { e.target.style.background = 'var(--green)'; e.target.style.color = 'white' }} onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--green)' }}>{simulating ? 'Simulating…' : '⚡ Lights ON'}</button><button onClick={handleOff} disabled={simulatingOff || scenarioRunning} style={{ padding: '11px 28px', background: 'none', border: '1.5px solid var(--red)', borderRadius: 9, color: 'var(--red)', fontFamily: 'Geist, sans-serif', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.18s' }} onMouseEnter={e => { e.target.style.background = 'var(--red)'; e.target.style.color = 'white' }} onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--red)' }}>{simulatingOff ? 'Turning off…' : '🌑 Lights OFF'}</button><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: room?.is_active ? 'var(--green)' : '#ccc', animation: room?.is_active ? 'livePulse 1.8s infinite' : 'none' }} /><span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>Current: <strong>{room?.is_active ? 'ON' : 'OFF'}</strong></span></div></div></div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', marginBottom: scenarioRunning ? 20 : 0 }}><div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 4 }}>Scenario Runner</div><div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: 20 }}>Run a realistic multi-step simulation to test system behavior over time.</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>{scenarios.map(sc => (<div key={sc.id} style={{ background: scenario === sc.id ? 'rgba(0,200,150,0.06)' : 'var(--bg)', border: `1.5px solid ${scenario === sc.id ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`, borderRadius: 10, padding: '18px' }}><div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-1)', marginBottom: 6 }}>{sc.name}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14 }}>{sc.desc}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 12 }}>{sc.steps.length} steps</div><button onClick={() => runScenario(sc)} disabled={scenarioRunning} style={{ width: '100%', padding: '8px', background: scenario === sc.id && scenarioRunning ? 'var(--green-dim)' : 'var(--dark)', color: 'var(--green)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 7, fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', fontWeight: 500, cursor: scenarioRunning ? 'not-allowed' : 'pointer', opacity: scenarioRunning && scenario !== sc.id ? 0.5 : 1 }}>{scenario === sc.id && scenarioRunning ? '▶ Running…' : '▶ Run'}</button></div>))}</div></div>
      <AnimatePresence>{scenarioRunning && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ background: 'var(--dark)', borderRadius: 12, padding: '20px 24px', marginTop: 0, overflow: 'hidden' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><span style={{ color: 'var(--green)', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>● Scenario Running</span><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>{scenarioProgress}%</span></div><div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}><motion.div style={{ height: '100%', background: 'var(--green)', borderRadius: 99 }} animate={{ width: `${scenarioProgress}%` }} /></div>{scenarioLog.map((step, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}><span style={{ fontSize: '0.7rem', color: step.status === 'done' ? 'var(--green)' : 'rgba(255,255,255,0.3)', fontFamily: 'monospace', width: 80 }}>{step.time}</span><span style={{ fontSize: '0.82rem', color: step.status === 'done' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)' }}>{step.label}</span><span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: step.status === 'done' ? 'var(--green)' : '#f59e0b' }}>{step.status === 'done' ? '✓' : '…'}</span></div>))}</motion.div>)}</AnimatePresence>
    </motion.div>
  )
}

function MultiRoomPage({ rooms }) {
  const chartOpts = { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#4a5e52', font: { size: 11 } } }, tooltip: { backgroundColor: '#0e1a14', titleColor: '#fff', bodyColor: '#8fa898' } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } } } }
  const roomColors = ['rgba(0,200,150,0.7)', 'rgba(99,102,241,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)']
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const energyDatasets = rooms.map((room, i) => ({ label: `Room ${room.name}`, data: room.energy_logs?.slice(-7).map(l => l.energy_saved) || weekDays.map(() => Math.random() * 0.5), backgroundColor: roomColors[i], borderColor: roomColors[i], borderRadius: 5 }))
  const hoursDatasets = rooms.map((room, i) => ({ label: `Room ${room.name}`, data: room.energy_logs?.slice(-7).map(l => l.hours_on) || weekDays.map(() => Math.random() * 4), borderColor: roomColors[i], backgroundColor: roomColors[i].replace('0.7', '0.08'), borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: roomColors[i], pointRadius: 4 }))

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 24 }}><h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Multi-Room Comparison</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Compare energy usage and performance across all rooms</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(rooms.length, 4)}, 1fr)`, gap: 14, marginBottom: 24 }}>{rooms.map((room, i) => (<div key={room.id} style={{ background: 'var(--surface)', border: `1.5px solid ${room.is_active ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: '20px', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', top: 0, left: 0, width: 3, bottom: 0, background: roomColors[i], borderRadius: '3px 0 0 3px' }} /><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}><div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)' }}>Room {room.name}</div><span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: room.is_active ? '#d1fae5' : '#fee2e2', color: room.is_active ? '#065f46' : '#991b1b' }}>{room.is_active ? 'ON' : 'OFF'}</span></div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[{ label: 'Energy Saved', val: `${(room.energy_saved_today || 0).toFixed(3)} kWh` },{ label: 'Peso Savings', val: `₱${((room.energy_saved_today || 0) * ZAMCELCO_RATE).toFixed(2)}` },{ label: 'Status', val: room.occupancy ? 'Occupied' : 'Vacant' }].map((s, j) => (<div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}><span style={{ color: 'var(--text-3)' }}>{s.label}</span><strong style={{ color: 'var(--text-1)' }}>{s.val}</strong></div>))}</div></div>))}</div>
      {rooms.length === 0 ? (<div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px', textAlign: 'center' }}><div style={{ fontSize: '0.9rem', color: 'var(--text-3)' }}>No rooms found.</div></div>) : (<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 4 }}>Energy Saved — All Rooms</div><div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 20 }}>kWh saved per day this week</div><Bar data={{ labels: weekDays, datasets: energyDatasets }} options={chartOpts} /></div><div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 4 }}>Light Hours — All Rooms</div><div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 20 }}>Hours lights were on per day</div><Line data={{ labels: weekDays, datasets: hoursDatasets }} options={chartOpts} /></div></div>)}
    </motion.div>
  )
}

function TimelinePage({ rooms, selectedRoom }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [currentEvent, setCurrentEvent] = useState(null)
  const intervalRef = useRef(null)
  const room = rooms.find(r => r.name === selectedRoom)
  const events = (room?.events || []).slice().reverse()
  const currentEventIndex = Math.floor((progress / 100) * (events.length - 1))
  const displayedEvents = events.slice(0, currentEventIndex + 1)
  const activeEvent = events[currentEventIndex]
  useEffect(() => { if (playing) { intervalRef.current = setInterval(() => { setProgress(p => { if (p >= 100) { setPlaying(false); return 100 } return Math.min(p + (0.5 * speed), 100) }) }, 100) } else { clearInterval(intervalRef.current) } return () => clearInterval(intervalRef.current) }, [playing, speed])
  useEffect(() => { if (activeEvent) setCurrentEvent(activeEvent) }, [currentEventIndex])
  const reset = () => { setProgress(0); setPlaying(false); setCurrentEvent(null) }
  const lightsOnAtCurrent = activeEvent?.status === 'on'

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 24 }}><h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>Timeline Playback — Room {selectedRoom}</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Replay the day's events and watch the room respond in real time</p></div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', marginBottom: 20 }}><input type="range" min={0} max={100} value={progress} onChange={e => { setProgress(Number(e.target.value)); setPlaying(false) }} style={{ width: '100%', accentColor: 'var(--green)', cursor: 'pointer', marginBottom: 16 }} /><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 20 }}><span>{events[0] ? new Date(events[0].timestamp).toLocaleTimeString() : '—'}</span><span style={{ color: 'var(--green)', fontWeight: 500 }}>{Math.round(progress)}% through the day</span><span>{events[events.length - 1] ? new Date(events[events.length - 1].timestamp).toLocaleTimeString() : '—'}</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><button onClick={() => setPlaying(!playing)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 22px', background: playing ? 'var(--bg)' : 'var(--green)', color: playing ? 'var(--text-1)' : 'white', border: '1.5px solid var(--border)', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>{playing ? '⏸ Pause' : '▶ Play'}</button><button onClick={reset} style={{ padding: '9px 16px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.88rem', color: 'var(--text-2)', cursor: 'pointer' }}>↺ Reset</button><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Speed:</span>{[0.5, 1, 2, 4].map(s => (<button key={s} onClick={() => setSpeed(s)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${speed === s ? 'var(--green)' : 'var(--border)'}`, background: speed === s ? 'var(--green-dim)' : 'var(--bg)', color: speed === s ? 'var(--green)' : 'var(--text-3)', cursor: 'pointer' }}>{s}×</button>))}</div><div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: lightsOnAtCurrent ? 'rgba(0,200,150,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${lightsOnAtCurrent ? 'rgba(0,200,150,0.3)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: lightsOnAtCurrent ? 'var(--green)' : 'var(--red)', display: 'inline-block', animation: lightsOnAtCurrent ? 'livePulse 1.8s infinite' : 'none' }} /><span style={{ fontSize: '0.8rem', fontWeight: 600, color: lightsOnAtCurrent ? 'var(--green)' : 'var(--red)' }}>Room {selectedRoom} — Lights {lightsOnAtCurrent ? 'ON' : 'OFF'}</span></div></div></div>
      {currentEvent && (<motion.div key={currentEvent.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} style={{ background: currentEvent.status === 'on' ? 'rgba(0,200,150,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${currentEvent.status === 'on' ? 'rgba(0,200,150,0.25)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center' }}><div style={{ width: 36, height: 36, borderRadius: '50%', background: currentEvent.status === 'on' ? 'var(--green-dim)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{currentEvent.status === 'on' ? '💡' : '🌑'}</div><div><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>{currentEvent.event_type}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 2 }}>{new Date(currentEvent.timestamp).toLocaleString()} · Duration: {currentEvent.duration || '—'}</div></div></motion.div>)}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}><div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-1)', marginBottom: 16 }}>Event Timeline</div>{events.length === 0 ? (<div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem', padding: '24px' }}>No events to replay. Simulate motion first.</div>) : (<div style={{ position: 'relative' }}><div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} /><div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>{displayedEvents.slice(-12).map((ev, i) => { const isActive = ev === activeEvent; return (<motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', paddingLeft: 8 }}><div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${ev.status === 'on' ? 'var(--green)' : 'var(--red)'}`, background: isActive ? (ev.status === 'on' ? 'var(--green)' : 'var(--red)') : 'white', flexShrink: 0, zIndex: 1 }} /><div style={{ fontSize: '0.78rem', color: 'var(--text-3)', width: 70, flexShrink: 0 }}>{new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div><div style={{ fontSize: '0.82rem', color: isActive ? 'var(--text-1)' : 'var(--text-2)', fontWeight: isActive ? 600 : 400 }}>{ev.event_type}</div><span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: ev.status === 'on' ? '#d1fae5' : '#fee2e2', color: ev.status === 'on' ? '#065f46' : '#991b1b' }}>{ev.status === 'on' ? 'Active' : 'Ended'}</span></motion.div>) })}</div></div>)}</div>
    </motion.div>
  )
}

function ESP32Card({ room }) {
  const isConnected = room?.last_motion && (Date.now() - new Date(room.last_motion).getTime()) < 30000
  return (
    <div className="esp32-card">
      <div className="esp32-header"><span className="esp32-title">ESP32 Device</span><span className={`esp32-badge ${isConnected ? 'esp32-connected' : 'esp32-offline'}`}><span className="esp32-dot" />{isConnected ? 'Connected' : 'Offline'}</span></div>
      <div className="esp32-info">
        <div className="esp32-row"><span>Room</span><strong>{room?.name || '—'}</strong></div>
        <div className="esp32-row"><span>Lights</span><strong style={{ color: room?.is_active ? 'var(--green)' : 'var(--red)' }}>{room?.is_active ? 'ON' : 'OFF'}</strong></div>
        <div className="esp32-row"><span>Last Ping</span><strong>{room?.last_motion ? new Date(room.last_motion).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</strong></div>
        <div className="esp32-row"><span>Endpoint</span><code style={{ fontSize: '0.68rem', color: 'var(--green)' }}>POST /api/motion/</code></div>
      </div>
    </div>
  )
}

function ReportPage({ rooms, selectedRoom }) {
  const room = rooms.find(r => r.name === selectedRoom)
  const totalEvents = room?.events?.length || 0
  const onEvents = room?.events?.filter(e => e.status === 'on').length || 0
  const offEvents = totalEvents - onEvents
  const occupancyPct = totalEvents > 0 ? Math.round((onEvents / totalEvents) * 100) : 0
  const energySaved = room?.energy_saved_today || 0
  const pesoCost = (energySaved * ZAMCELCO_RATE).toFixed(2)
  const hoursOn = room?.energy_logs?.reduce((a, b) => a + b.hours_on, 0).toFixed(1) || 0
  const weekLabels = room?.energy_logs?.slice(-7).map(l => l.date?.slice(5)) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weekHours = room?.energy_logs?.slice(-7).map(l => l.hours_on) || [0, 0, 0, 0, 0, 0, 0]
  const weekSaved = room?.energy_logs?.slice(-7).map(l => l.energy_saved) || [0, 0, 0, 0, 0, 0, 0]
  const handleExport = () => { if (!room?.events?.length) return; const rows = [['Time', 'Event', 'Room', 'Duration', 'Status']]; room.events.forEach(e => rows.push([new Date(e.timestamp).toLocaleString(), e.event_type, `Room ${room.name}`, e.duration, e.status === 'on' ? 'Active' : 'Ended'])); const csv = rows.map(r => r.join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `sec-room-${selectedRoom}-report.csv`; a.click(); URL.revokeObjectURL(url) }
  const chartOpts = { responsive: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0e1a14', titleColor: '#fff', bodyColor: '#8fa898' } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 10 } } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 10 } } } } }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="report-header"><div><h2 className="report-title">Weekly Report — Room {selectedRoom}</h2><p className="report-sub">Summary of energy usage, occupancy, and savings</p></div><button className="export-btn" onClick={handleExport}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export CSV</button></div>
      <div className="report-stat-grid">{[{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, bg: 'rgba(0,200,150,0.1)', val: totalEvents, label: 'Total Events' },{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, bg: 'rgba(99,102,241,0.1)', val: `${hoursOn}h`, label: 'Total Hours ON' },{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, bg: 'rgba(245,158,11,0.1)', val: `₱${pesoCost}`, label: 'Peso Savings' },{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, bg: 'rgba(16,185,129,0.1)', val: `${occupancyPct}%`, label: 'Occupancy Rate' },{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, bg: 'rgba(239,68,68,0.1)', val: energySaved.toFixed(2), label: 'kWh Saved' },{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, bg: 'rgba(139,92,246,0.1)', val: onEvents, label: 'Motion Detections' }].map((s, i) => (<div key={i} className="report-stat-card"><div className="report-stat-icon" style={{ background: s.bg }}>{s.icon}</div><div className="report-stat-val">{s.val}</div><div className="report-stat-label">{s.label}</div></div>))}</div>
      <div className="charts-row" style={{ marginBottom: 24 }}><div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Daily Light Hours</span><span className="chart-panel-sub">Hours lights were on per day</span></div><Bar data={{ labels: weekLabels, datasets: [{ data: weekHours, backgroundColor: 'rgba(0,200,150,0.18)', borderColor: 'rgba(0,200,150,0.75)', borderWidth: 1.5, borderRadius: 6 }] }} options={chartOpts} /></div><div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Energy Savings</span><span className="chart-panel-sub">kWh saved per day this week</span></div><Line data={{ labels: weekLabels, datasets: [{ data: weekSaved, borderColor: 'rgba(0,200,150,0.85)', backgroundColor: 'rgba(0,200,150,0.07)', borderWidth: 2, tension: 0.45, pointBackgroundColor: 'var(--green)', pointRadius: 4, fill: true }] }} options={chartOpts} /></div></div>
      <div className="charts-row" style={{ marginBottom: 24 }}><div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Event Breakdown</span><span className="chart-panel-sub">ON vs OFF events ratio</span></div><div style={{ maxWidth: 220, margin: '0 auto' }}><Doughnut data={{ labels: ['Lights ON', 'Lights OFF'], datasets: [{ data: [onEvents || 1, offEvents || 1], backgroundColor: ['rgba(0,200,150,0.8)', 'rgba(239,68,68,0.7)'], borderWidth: 0 }] }} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#4a5e52', font: { size: 12 } } }, tooltip: { backgroundColor: '#0e1a14', titleColor: '#fff', bodyColor: '#8fa898' } }, cutout: '65%' }} /></div></div><div className="chart-panel"><div className="chart-panel-head"><span className="chart-panel-title">Energy Cost Calculator</span><span className="chart-panel-sub">Based on ZAMCELCO rate ₱{ZAMCELCO_RATE}/kWh</span></div><div className="cost-breakdown"><div className="cost-row"><span>Energy saved today</span><strong>{energySaved.toFixed(3)} kWh</strong></div><div className="cost-row"><span>Total hours ON</span><strong>{hoursOn} hrs</strong></div><div className="cost-row"><span>ZAMCELCO rate</span><strong>₱{ZAMCELCO_RATE}/kWh</strong></div><div className="cost-row cost-total"><span>Estimated Savings</span><strong style={{ color: 'var(--green)', fontSize: '1.2rem' }}>₱{pesoCost}</strong></div><div className="cost-note">Savings compared to leaving lights on all day (8hrs baseline).</div></div></div></div>
    </motion.div>
  )
}

function DevicePage({ currentRoom }) {
  const [modelMotion, setModelMotion] = useState(false)
  const [activeStep, setActiveStep] = useState(null)
  const ESP32_CODE = `#include <WiFi.h>\n#include <HTTPClient.h>\n\nconst char* ssid     = "ohyoudonthaveloadhowpoor";\nconst char* password = "gelatninjer";\nconst char* serverURL = "http://YOUR_SERVER_IP:8000/api/motion/";\n\nconst int PIR_PIN  = 13;\nconst int RELAY_PIN = 2;\nconst char* ROOM   = "A";\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(PIR_PIN, INPUT);\n  pinMode(RELAY_PIN, OUTPUT);\n  digitalWrite(RELAY_PIN, LOW);\n  WiFi.mode(WIFI_STA);\n  WiFi.begin(ssid, password);\n  Serial.print("Connecting to hotspot");\n  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }\n  Serial.println("\\nWiFi connected!");\n  Serial.print("IP address: ");\n  Serial.println(WiFi.localIP());\n}\n\nvoid sendEvent(const char* event) {\n  if (WiFi.status() != WL_CONNECTED) { Serial.println("WiFi disconnected, skipping POST"); return; }\n  HTTPClient http;\n  http.begin(serverURL);\n  http.addHeader("Content-Type", "application/json");\n  String body = "{\\"room\\":\\"" + String(ROOM) + "\\",\\"event\\":\\"" + String(event) + "\\",\\"source\\":\\"esp32\\"}";\n  int code = http.POST(body);\n  Serial.print("HTTP response: "); Serial.println(code);\n  http.end();\n}\n\nint lastState = LOW;\n\nvoid loop() {\n  int state = digitalRead(PIR_PIN);\n  if (state == HIGH && lastState == LOW) { digitalWrite(RELAY_PIN, HIGH); Serial.println("Motion detected — Lights ON"); sendEvent("Lights ON"); }\n  if (state == LOW && lastState == HIGH) { delay(7000); if (digitalRead(PIR_PIN) == LOW) { digitalWrite(RELAY_PIN, LOW); Serial.println("No motion — Lights OFF"); sendEvent("Lights OFF"); } }\n  lastState = state; delay(500);\n}`
  const tutorialSteps = [{ num: 1, color: '#00c896', title: 'Gather Your Components', desc: 'You need: ESP32 board, PIR motion sensor (HC-SR501), 5V Relay module, 2.5V bulb with socket, 9V battery with connector, breadboard, and jumper wires.', detail: 'Make sure your relay module is rated for at least 5V coil voltage. The 9V battery connects to the relay output side to power the 2.5V bulb through a resistor.' },{ num: 2, color: '#6366f1', title: 'Wire the PIR Sensor to ESP32', desc: 'PIR VCC → 3.3V pin on ESP32. PIR GND → GND on ESP32. PIR OUT → GPIO 13 on ESP32.', detail: 'The PIR sensor outputs HIGH (3.3V) when motion is detected and LOW when idle. GPIO 13 reads this signal. No resistor needed for the PIR data line.' },{ num: 3, color: '#f59e0b', title: 'Wire the Relay Module to ESP32', desc: 'Relay VCC → 5V pin (VIN) on ESP32. Relay GND → GND on ESP32. Relay IN → GPIO 2 on ESP32.', detail: 'GPIO 2 controls the relay coil. When ESP32 sends HIGH to GPIO 2, the relay closes its switch. Use the NO (Normally Open) terminal on the relay for the bulb circuit.' },{ num: 4, color: '#ef4444', title: 'Wire the 9V Battery + Resistor + Bulb', desc: 'Battery (+) → Relay COM terminal. Relay NO terminal → Resistor (680Ω) → Bulb (+). Bulb (−) → Battery (−).', detail: 'The 9V battery powers the bulb through the relay. Since your bulb is 2.5V 3W, use a 680Ω resistor (9V − 2.5V = 6.5V drop, 6.5 ÷ 0.012A ≈ 540Ω, round up to 680Ω for safety). This protects your tiny bulb from burning out.' },{ num: 5, color: '#8b5cf6', title: 'Connect ESP32 to Phone Hotspot', desc: 'Enable hotspot on your phone: name it "ohyoudonthaveloadhowpoor", password "gelatninjer". The ESP32 code already has these credentials.', detail: 'Make sure your Django backend server is also on the same network or has a public IP. Replace YOUR_SERVER_IP in the code with your laptop\'s IP address (check with ipconfig on Windows or ifconfig on Mac/Linux).' },{ num: 6, color: '#10b981', title: 'Flash the Code via Arduino IDE', desc: 'Install Arduino IDE → Add ESP32 board URL in preferences → Install "ESP32 by Espressif" from board manager → Select your board → Upload.', detail: 'Board manager URL: https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json — Select board: "ESP32 Dev Module". Open Serial Monitor at 115200 baud to see debug logs.' },{ num: 7, color: '#f59e0b', title: 'Test the Full System', desc: 'Power on ESP32 → watch Serial Monitor for WiFi connection → wave your hand in front of PIR → bulb should turn ON and dashboard should update.', detail: 'If nothing happens: check your server IP in the code, make sure Django is running (python manage.py runserver 0.0.0.0:8000), and verify the PIR is warmed up (takes 30-60 seconds after power-on).' }]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="device-page">
        <ESP32Card room={currentRoom} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="device-guide">
            <h3 className="device-guide-title">ESP32 Arduino Code</h3>
            <p className="device-guide-sub">Flash this to your ESP32. WiFi is pre-configured for your phone hotspot. Replace <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem' }}>YOUR_SERVER_IP</code> with your laptop's local IP before uploading.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 14px', background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 8 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'livePulse 1.8s infinite' }} /><span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>Hotspot: <strong style={{ color: 'var(--text-1)' }}>ohyoudonthaveloadhowpoor</strong> · Password: <strong style={{ color: 'var(--text-1)' }}>gelatninjer</strong></span></div>
            <div className="code-block"><pre>{ESP32_CODE}</pre></div>
            <div className="device-pins">{[['PIR VCC', '3.3V or 5V'],['PIR GND', 'GND'],['PIR OUT', 'GPIO 13'],['Relay IN', 'GPIO 2'],['Relay VCC', '5V (VIN)'],['Relay GND', 'GND'],['Bulb (+)', 'Relay NO'],['Bulb (−)', 'Battery (−)'],['Battery (+)', 'Relay COM'],['Resistor', '680Ω in series']].map(([l, v], i) => (<div key={i} className="pin-row"><span className="pin-label">{l}</span><span className="pin-val">{v}</span></div>))}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px' }}><h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)', marginBottom: 6 }}>Step-by-Step Wiring Tutorial</h3><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.6 }}>Follow each step carefully. Click any step to expand details. Your bulb is 2.5V 3W — the resistor is critical to prevent burning it out.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>{[{ icon: '🔲', name: 'ESP32', desc: 'Main microcontroller', color: '#1a5c22' },{ icon: '👁️', name: 'PIR Sensor', desc: 'HC-SR501 motion detector', color: '#cc4444' },{ icon: '⚡', name: 'Relay Module', desc: '5V coil, switches bulb', color: '#0a3a7a' },{ icon: '💡', name: '2.5V Bulb', desc: '3W, tiny socket bulb', color: '#c87820' },{ icon: '🔋', name: '9V Battery', desc: 'Powers bulb circuit', color: '#cc2200' },{ icon: '🟫', name: 'Breadboard', desc: 'Prototyping connections', color: '#888' },{ icon: '〰️', name: '680Ω Resistor', desc: 'Protects 2.5V bulb', color: '#c8a864' },{ icon: '🔌', name: 'Jumper Wires', desc: 'Male-to-male + M-to-F', color: '#4488ff' }].map((comp, i) => (<div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, transition: 'box-shadow 0.2s' }}><div style={{ width: 48, height: 48, borderRadius: 12, background: `${comp.color}18`, border: `1.5px solid ${comp.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>{comp.icon}</div><div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>{comp.name}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{comp.desc}</div></div>))}</div><div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 16 }}>Wiring Steps</div><div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>{tutorialSteps.map((step) => (<div key={step.num} onClick={() => setActiveStep(activeStep === step.num ? null : step.num)} style={{ background: activeStep === step.num ? `${step.color}08` : 'var(--bg)', border: `1.5px solid ${activeStep === step.num ? step.color + '44' : 'var(--border)'}`, borderRadius: 10, padding: '16px', cursor: 'pointer', transition: 'all 0.18s' }}><div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}><div style={{ width: 30, height: 30, borderRadius: '50%', background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 1 }}>{step.num}</div><div style={{ flex: 1 }}><div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{step.title}</div><div style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{step.desc}</div><AnimatePresence>{activeStep === step.num && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}><div style={{ marginTop: 12, padding: '12px 14px', background: `${step.color}10`, border: `1px solid ${step.color}30`, borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.7 }}>💡 {step.detail}</div></motion.div>)}</AnimatePresence></div><div style={{ color: activeStep === step.num ? step.color : 'var(--text-3)', fontSize: '0.9rem', flexShrink: 0 }}>{activeStep === step.num ? '▲' : '▼'}</div></div></div>))}</div><div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', fontSize: '0.82rem', color: '#92400e', lineHeight: 1.6 }}><span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span><span><strong>Safety Note:</strong> Your 2.5V 3W bulb uses about 1.2A at full voltage. With 9V battery and 680Ω resistor, current ≈ 9.6mA — well within safe range. Never connect the bulb directly to 9V without the resistor or it will instantly burn out. The relay isolates the high-current bulb circuit from the ESP32 low-voltage logic circuit.</span></div></div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}><div><h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)', marginBottom: 4 }}>3D Circuit Wiring Model</h3><p style={{ fontSize: '0.82rem', color: 'var(--text-3)', lineHeight: 1.6 }}>Interactive 3D view of your exact components. Drag to orbit · Scroll to zoom · Right-click to pan. Colored wires show data flow direction.</p></div><button onClick={() => setModelMotion(!modelMotion)} style={{ padding: '8px 18px', background: modelMotion ? 'rgba(0,200,150,0.1)' : 'var(--bg)', border: `1.5px solid ${modelMotion ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', fontWeight: 500, color: modelMotion ? 'var(--green)' : 'var(--text-2)', cursor: 'pointer', transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: modelMotion ? 'var(--green)' : '#ccc', display: 'inline-block', animation: modelMotion ? 'livePulse 1.8s infinite' : 'none' }} />{modelMotion ? 'Motion Active — Bulb ON' : 'Simulate Motion'}</button></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>{[{ color: '#ff4444', label: 'VCC / Power' },{ color: '#222222', label: 'GND' },{ color: '#00c896', label: 'PIR Signal (GPIO 13)' },{ color: '#4488ff', label: 'Relay Control (GPIO 2)' },{ color: '#ff6600', label: 'Bulb Circuit (9V)' },{ color: '#ff8844', label: 'Relay Output' }].map((item, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', borderRadius: 6, padding: '4px 10px', border: '1px solid var(--border)' }}><span style={{ width: 10, height: 3, borderRadius: 2, background: item.color, display: 'inline-block' }} /><span style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontFamily: 'monospace' }}>{item.label}</span></div>))}</div><ESP32WiringModel showMotion={modelMotion} /><div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>{[{ title: 'PIR → ESP32', desc: 'GPIO 13 reads HIGH when motion detected', icon: '👁️' },{ title: 'ESP32 → Relay', desc: 'GPIO 2 sends signal to switch relay coil', icon: '⚡' },{ title: 'Relay → Bulb', desc: '9V battery powers 2.5V bulb via relay + resistor', icon: '💡' }].map((info, i) => (<div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}><div style={{ fontSize: '1rem', marginBottom: 6 }}>{info.icon}</div><div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{info.title}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{info.desc}</div></div>))}</div></div>
        </div>
      </div>
    </motion.div>
  )
}

function SettingsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 24 }}><h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>System Settings</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Technical details and system configuration</p></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}><div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 16 }}>Project Location</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.7 }}><div><strong style={{ color: 'var(--text-1)' }}>Institution:</strong> Western Mindanao State University</div><div><strong style={{ color: 'var(--text-1)' }}>Address:</strong> Baliwasan Road, Camp B, Zamboanga City, Philippines</div><div><strong style={{ color: 'var(--text-1)' }}>Department:</strong> College of Computing Studies (CCS)</div><div><strong style={{ color: 'var(--text-1)' }}>Building:</strong> CCS Department Building</div></div></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}><div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 16 }}>Technical Stack</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{[{ label: 'Frontend', val: 'React.js 18 + Vite', color: '#00c896' },{ label: 'Backend', val: 'Django 5 + Django REST', color: '#6366f1' },{ label: '3D Engine', val: 'React Three Fiber + Drei', color: '#f59e0b' },{ label: 'Charts', val: 'Chart.js + React-ChartJS', color: '#ef4444' },{ label: 'Animations', val: 'Framer Motion', color: '#8b5cf6' },{ label: 'Calendar', val: 'React-Calendar', color: '#10b981' },{ label: 'Production DB', val: 'PostgreSQL (Render)', color: '#4488ff' },{ label: 'Local DB', val: 'SQLite (Development)', color: '#888' },{ label: 'Frontend Deploy', val: 'Vercel', color: '#000' },{ label: 'Backend Deploy', val: 'Render', color: '#000' },{ label: 'Hardware', val: 'ESP32 Dev Module', color: '#1a5c22' },{ label: 'Sensor', val: 'HC-SR501 PIR + 5V Relay', color: '#cc4444' }].map((item, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg)', borderRadius: 8 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} /><div><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div><div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-1)' }}>{item.val}</div></div></div>))}</div></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}><div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 16 }}>Energy Provider</div><div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', background: 'rgba(0,200,150,0.06)', borderRadius: 10, border: '1px solid rgba(0,200,150,0.2)' }}><div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.8rem' }}>ZC</div><div><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>ZAMCELCO</div><div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Zamboanga City Electric Cooperative</div><div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: 2 }}>Rate: ₱{ZAMCELCO_RATE}/kWh · Location: Zamboanga City</div></div></div></div>
      </div>
    </motion.div>
  )
}

function AboutPage() {
  const developers = [{ name: 'Angel Garcia', role: 'Lead Developer & Hardware Integration', color: '#00c896' },{ name: 'Kurt Adlrich Canilang', role: 'Backend Developer & System Architecture', color: '#6366f1' },{ name: 'John Paul Enriquez', role: 'Frontend Developer & UI/UX Design', color: '#f59e0b' }]
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 24 }}><h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 400 }}>About SEC</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Project information and team details</p></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px' }}><div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-1)', marginBottom: 10 }}>Smart Environment Classroom (SEC)</div><p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.75, marginBottom: 16 }}>SEC is an IoT-based smart lighting automation system designed for classroom environments. It uses an ESP32 microcontroller with a PIR motion sensor and relay module to automatically control lighting based on room occupancy, reducing energy waste and operational costs.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>{[{ label: 'Project Type', val: 'IoT Automation System' },{ label: 'Subject', val: 'Internet of Things (IoT)' },{ label: 'Course', val: 'BSIT 3A' },{ label: 'Program', val: 'Bachelor of Science in Information Technology' },{ label: 'College', val: 'College of Computing Studies' },{ label: 'University', val: 'Western Mindanao State University' }].map((item, i) => (<div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}><div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div><div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-1)' }}>{item.val}</div></div>))}</div><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 10 }}>System Purpose</div><p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 16 }}>The system addresses energy inefficiency in classroom lighting by implementing motion-based automation. When the PIR sensor detects movement, lights turn on automatically. After a timeout period with no motion, lights turn off. This eliminates manual switching and prevents lights from remaining on in vacant rooms.</p><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 10 }}>Key Features</div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{['Real-time motion detection via ESP32 and PIR sensor','Automatic relay-controlled light switching','Web dashboard with live status monitoring','Energy savings tracking with ZAMCELCO rate calculation','Historical data viewing by date','Multi-room support and comparison','3D interactive wiring visualization','AI-powered energy insights and recommendations','Automation rules engine','Scenario simulation for testing'].map((feat, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: 'var(--text-2)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />{feat}</div>))}</div></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px' }}><div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 16 }}>Hardware Components</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>{[{ name: 'ESP32 Dev Module', desc: 'Main WiFi-enabled microcontroller', icon: '🔲' },{ name: 'HC-SR501 PIR', desc: 'Passive infrared motion sensor', icon: '👁️' },{ name: '5V Relay Module', desc: 'Electromechanical switch for bulb', icon: '⚡' },{ name: '2.5V Bulb (3W)', desc: 'Low-voltage indicator lamp', icon: '💡' },{ name: '9V Battery', desc: 'Power source for bulb circuit', icon: '🔋' },{ name: '680Ω Resistor', desc: 'Current limiting for bulb protection', icon: '〰️' },{ name: 'Breadboard', desc: 'Prototyping board for connections', icon: '🟫' },{ name: 'Jumper Wires', desc: 'Male-to-male and male-to-female', icon: '🔌' }].map((h, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: 'var(--bg)', borderRadius: 8 }}><span style={{ fontSize: '1.2rem' }}>{h.icon}</span><div><div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>{h.name}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{h.desc}</div></div></div>))}</div></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px' }}><div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 16 }}>Developers</div><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{developers.map((dev, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}><div style={{ width: 42, height: 42, borderRadius: '50%', background: dev.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>{dev.name.split(' ').map(n => n[0]).join('')}</div><div><div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)' }}>{dev.name}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{dev.role}</div></div></div>))}</div></div>
      </div>
    </motion.div>
  )
}

function DashboardScreen({ onLogout }) {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('A')
  const [initialLoading, setInitialLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [simulatingOff, setSimulatingOff] = useState(false)
  const [clock, setClock] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewingDate, setViewingDate] = useState(null)
  const [historicalData, setHistoricalData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [newEventIds, setNewEventIds] = useState(new Set())
  const [toasts, setToasts] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(null)
  const [modalData, setModalData] = useState(null)
  const [viewMode, setViewMode] = useState('day')
  const [demoMode, setDemoMode] = useState(() => { try { return localStorage.getItem('sec_demo') === 'true' } catch { return false } })
  const [savedInsights, setSavedInsights] = useState(() => { try { return JSON.parse(localStorage.getItem('sec_saved_insights') || '[]') } catch { return [] } })
  const prevEventCount = useRef(0)
  const intervalRef = useRef(null)
  const pollRef = useRef(null)
  const toastId = useRef(0)

  const addToast = (msg, type = 'success') => { const id = ++toastId.current; setToasts(p => [...p, { id, msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500) }

  const generateDemoData = () => { const now = new Date(); const demoEvents = []; const demoLogs = []; const hours = [2.5, 4.1, 3.2, 5.0, 1.8, 0.5, 3.7]; for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const dateStr = d.toISOString().slice(0, 10); const h = hours[6 - i]; const saved = (h * 0.09).toFixed(3); demoLogs.push({ date: dateStr, hours_on: h, energy_saved: parseFloat(saved) }); const eventCount = Math.floor(Math.random() * 4) + 2; for (let j = 0; j < eventCount; j++) { const t = new Date(d); t.setHours(7 + j * 2, Math.floor(Math.random() * 60), 0); demoEvents.push({ id: `demo-${i}-${j}`, timestamp: t.toISOString(), event_type: j % 2 === 0 ? 'Motion Detected' : 'Lights Auto-OFF', status: j % 2 === 0 ? 'on' : 'off', duration: j % 2 === 0 ? '—' : '7s timeout' }) } } demoEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); const demoRoom = { id: 1, name: selectedRoom || 'A', is_active: false, occupancy: false, energy_saved_today: parseFloat(demoLogs[demoLogs.length - 1].energy_saved), last_motion: demoEvents[0].timestamp, events: demoEvents, energy_logs: demoLogs }; setRooms([demoRoom]); setDemoMode(true); localStorage.setItem('sec_demo', 'true'); addToast('Demo mode active — simulated ESP32 data loaded', 'info') }

  const exitDemo = () => { setDemoMode(false); localStorage.removeItem('sec_demo'); setRooms([]); setInitialLoading(true); loadRooms(); addToast('Exited demo mode — connecting to real ESP32', 'success') }

  const saveInsight = (insight) => { const entry = { ...insight, id: Date.now(), room: selectedRoom, date: new Date().toISOString() }; const updated = [entry, ...savedInsights]; setSavedInsights(updated); localStorage.setItem('sec_saved_insights', JSON.stringify(updated)); addToast('Insight saved', 'success') }
  const deleteInsight = (id) => { const updated = savedInsights.filter(s => s.id !== id); setSavedInsights(updated); localStorage.setItem('sec_saved_insights', JSON.stringify(updated)); addToast('Insight deleted', 'info') }

  const loadRooms = useCallback(async (silent = false) => {
    if (demoMode) return
    try { const data = await fetchRooms(); setRooms(prev => { const newRoom = data.find(r => r.name === selectedRoom); const prevRoom = prev.find(r => r.name === selectedRoom); if (prevRoom && newRoom && newRoom.events?.length > prevEventCount.current) { const newIds = new Set(newRoom.events.slice(0, newRoom.events.length - prevEventCount.current).map(e => e.id)); setNewEventIds(newIds); setTimeout(() => setNewEventIds(new Set()), 2000); if (silent) addToast(`Motion detected in Room ${selectedRoom}!`, 'success') } if (newRoom) prevEventCount.current = newRoom.events?.length || 0; return data }); if (data.length > 0 && !selectedRoom) setSelectedRoom(data[0].name) } catch {} finally { setInitialLoading(false) }
  }, [selectedRoom, demoMode])

  useEffect(() => { loadRooms() }, [])
  useEffect(() => { pollRef.current = setInterval(() => { if (!viewingDate && !demoMode) loadRooms(true) }, POLL_INTERVAL); return () => clearInterval(pollRef.current) }, [viewingDate, demoMode, loadRooms])
  useEffect(() => { const tick = () => { const now = new Date(); setClock(now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '  |  ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })) }; tick(); intervalRef.current = setInterval(tick, 1000); return () => clearInterval(intervalRef.current) }, [])

  const handleSimulate = async () => { if (!selectedRoom) return; setSimulating(true); try { await simulateMotion(selectedRoom); await loadRooms(); setViewingDate(null); addToast('Lights ON — motion simulated!', 'success') } catch { addToast('Simulation failed', 'warning') } finally { setSimulating(false) } }
  const handleSimulateOff = async () => { if (!selectedRoom) return; setSimulatingOff(true); try { await simulateLightsOff(selectedRoom); await loadRooms(); addToast('Lights OFF — simulated!', 'info') } catch { addToast('Simulation failed', 'warning') } finally { setSimulatingOff(false) } }
  const handleDateChange = async (date) => { setSelectedDate(date); setShowCalendar(false); const today = new Date(); today.setHours(0,0,0,0); const sel = new Date(date); sel.setHours(0,0,0,0); if (sel > today) { setViewingDate('future'); setHistoricalData(null); return } if (sel.getTime() === today.getTime()) { setViewingDate(null); setHistoricalData(null); return } setHistoryLoading(true); setHistoricalData(null); setViewingDate('past'); try { const data = await fetchRoomHistory(selectedRoom, date.getFullYear(), date.getMonth() + 1, date.getDate()); setHistoricalData(data) } catch { setHistoricalData({ events: [], energy_logs: [], occupancy: false, energy_saved_today: 0 }) } finally { setHistoryLoading(false) } }

  const currentRoom = rooms.find(r => r.name === selectedRoom)
  let displayRoom = currentRoom; let isEmpty = true, isFuture = false
  if (viewingDate === 'future') { isFuture = true }
  else if (viewingDate === 'past' && historicalData) { displayRoom = { ...currentRoom, ...historicalData }; isEmpty = !historicalData.events || historicalData.events.length === 0 }
  else { isEmpty = !currentRoom?.events || currentRoom.events.length === 0 }
  const hasEvents = !isEmpty && !isFuture

  const getWeekLabels = () => { const days = []; const base = viewingDate === 'past' && selectedDate ? new Date(selectedDate) : new Date(); for (let i = 6; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); days.push(d.toLocaleDateString('en-US', { weekday: 'short' })) } return days }
  const weekDays = getWeekLabels()
  const energyHours = displayRoom?.energy_logs?.slice(-7).map(l => l.hours_on) || [1.2, 2.5, 3.1, 2.0, 1.8, 0.5, 2.2]
  const energySaved = displayRoom?.energy_logs?.slice(-7).map(l => l.energy_saved) || [0.15, 0.18, 0.22, 0.20, 0.17, 0.12, 0.19]
  const chartOptions = { responsive: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0e1a14', borderColor: 'rgba(0,200,150,0.2)', borderWidth: 1, titleColor: '#fff', bodyColor: '#8fa898' } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } } } }

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { key: 'rooms', label: 'Rooms', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { key: 'logs', label: 'Event Logs', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { key: 'report', label: 'Reports', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { key: 'multiroom', label: 'Multi-Room', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg> },
    { key: 'insights', label: 'Smart Insights', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg> },
    { key: 'timeline', label: 'Timeline', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="12" x2="3" y2="12"/><polyline points="11 8 3 12 11 16"/><line x1="21" y1="6" x2="21" y2="18"/></svg> },
    { key: 'automation', label: 'Automation', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
    { key: 'simulation', label: 'Simulation', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
    { key: 'device', label: 'ESP32 Device', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
    { key: 'classroom3d', label: '3D Classroom', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { key: 'settings', label: 'Settings', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    { key: 'about', label: 'About', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> },
  ]

  const pageTitles = { dashboard: 'Dashboard', rooms: 'Rooms', logs: 'Event Logs', report: 'Reports', device: 'ESP32 Device', classroom3d: '3D Classroom', insights: 'Smart Insights', automation: 'Automation', simulation: 'Simulation', timeline: 'Timeline', multiroom: 'Multi-Room', settings: 'Settings', about: 'About' }
  const navGroups = [{ label: 'Monitor', keys: ['dashboard', 'rooms', 'logs'] },{ label: 'Analyze', keys: ['report', 'multiroom', 'insights', 'timeline'] },{ label: 'Control', keys: ['automation', 'simulation'] },{ label: 'System', keys: ['device', 'classroom3d', 'settings', 'about'] }]

  if (initialLoading && !demoMode) return <PlexusLoader />

  return (
    <div className="dashboard-screen">
      <Toast toasts={toasts} />
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <div className="sidebar-brand"><span className="brand-sec">SEC</span><span className="brand-label">Smart Environment<br />Classroom</span></div>
        <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 13px 4px' }}>{group.label}</div>
              {navItems.filter(i => group.keys.includes(i.key)).map(item => (
                <button key={item.key} className={`nav-link ${activeNav === item.key ? 'active' : ''}`} onClick={() => { setActiveNav(item.key); setSidebarOpen(false) }}><span style={{ marginRight: 8 }}>{item.icon}</span>{item.label}</button>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ padding: '12px', background: demoMode ? 'rgba(0,200,150,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${demoMode ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.08)'}`, margin: '0 8px 8px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginBottom: 8, fontWeight: 500 }}>{demoMode ? '● Demo Mode Active' : 'No ESP32 Connected?'}</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', marginBottom: 10, lineHeight: 1.5 }}>{demoMode ? 'Using simulated data. Exit to connect real hardware.' : 'Try the demo to see how the dashboard works with sample data.'}</div>
          {demoMode ? (<button onClick={exitDemo} style={{ width: '100%', padding: '8px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 7, fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer' }}>Exit Demo — Connect ESP32</button>) : (<button onClick={generateDemoData} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>Try Demo</button>)}
        </div>
        <button className="sidebar-logout" onClick={onLogout} style={{ flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 7 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Logout</button>
      </aside>

      <div className="shell">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button><h1 className="topbar-title">{pageTitles[activeNav]}</h1></div>
          <div className="topbar-meta"><span className="topbar-clock">{clock}</span><button className="calendar-trigger-btn" onClick={() => setShowCalendar(!showCalendar)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button><select className="room-select" value={selectedRoom} onChange={e => { setSelectedRoom(e.target.value); setViewingDate(null); setHistoricalData(null) }}>{rooms.map(room => <option key={room.id} value={room.name}>Room {room.name}</option>)}</select></div>
        </header>

        <AnimatePresence>{showCalendar && (<motion.div className="calendar-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCalendar(false)} />)}</AnimatePresence>
        <AnimatePresence>{showCalendar && (<motion.div className="calendar-popup" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><Calendar onChange={handleDateChange} value={selectedDate} /></motion.div>)}</AnimatePresence>
        {viewingDate === 'past' && selectedDate && (<motion.div className="date-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}><span>Viewing data for <strong>{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span><button onClick={() => { setViewingDate(null); setHistoricalData(null); setSelectedDate(new Date()) }}>Back to Today</button></motion.div>)}

        <main className="dashboard-main">
          {activeNav === 'report' && <ReportPage rooms={rooms} selectedRoom={selectedRoom} />}
          {activeNav === 'insights' && <SmartInsightsPage rooms={rooms} selectedRoom={selectedRoom} savedInsights={savedInsights} onSaveInsight={saveInsight} onDeleteInsight={deleteInsight} />}
          {activeNav === 'automation' && <AutomationPage addToast={addToast} />}
          {activeNav === 'simulation' && <SimulationPage rooms={rooms} selectedRoom={selectedRoom} loadRooms={loadRooms} addToast={addToast} />}
          {activeNav === 'timeline' && <TimelinePage rooms={rooms} selectedRoom={selectedRoom} />}
          {activeNav === 'multiroom' && <MultiRoomPage rooms={rooms} />}
          {activeNav === 'device' && <DevicePage currentRoom={currentRoom} />}
          {activeNav === 'settings' && <SettingsPage />}
          {activeNav === 'about' && <AboutPage />}
          {activeNav === 'classroom3d' && (<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ height: 'calc(100vh - var(--topbar-h) - 64px)', display: 'flex', flexDirection: 'column' }}><Classroom3DPage /></motion.div>)}
          {activeNav === 'rooms' && (<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}><div className="rooms-grid">{rooms.map(room => (<div key={room.id} className={`room-card ${room.is_active ? 'room-active' : ''}`} onClick={() => { setSelectedRoom(room.name); setActiveNav('dashboard') }}><div className="room-card-top"><span className="room-card-name">Room {room.name}</span><StatusBadge on={room.is_active} /></div><div className="room-card-stat"><span>{room.occupancy ? 'Occupied' : 'Vacant'}</span><span>{room.energy_saved_today.toFixed(2)} kWh saved</span></div><div className="room-card-motion">Last motion: {room.last_motion ? new Date(room.last_motion).toLocaleTimeString() : 'Never'}</div></div>))}{rooms.length === 0 && <p style={{ color: 'var(--text-3)' }}>No rooms found.</p>}</div></motion.div>)}
          {activeNav === 'logs' && (<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}><div className="log-panel"><div className="log-panel-head"><span className="chart-panel-title">All Event Logs — Room {selectedRoom}</span><span className="live-badge"><span className="live-dot" />Live</span></div><div className="table-scroll"><table className="log-table"><thead><tr><th>Time</th><th>Event</th><th>Room</th><th>Duration</th><th>Status</th></tr></thead><tbody>{(currentRoom?.events || []).map((event, i) => (<tr key={i} className={i === 0 ? 'new-row' : ''}><td>{new Date(event.timestamp).toLocaleTimeString()}</td><td>{event.event_type}</td><td>Room {currentRoom.name}</td><td>{event.duration}</td><td><span className={`status-tag ${event.status}`}>{event.status === 'on' ? 'Active' : 'Ended'}</span></td></tr>))}{(!currentRoom?.events || currentRoom.events.length === 0) && (<tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>No events yet</td></tr>)}</tbody></table></div></div></motion.div>)}
          {activeNav === 'dashboard' && (<>
            {historyLoading ? (<div className="loading-state"><div className="dot-loader"><span /><span /><span /></div><p>Loading history…</p></div>) : isFuture ? (<div className="empty-state"><div className="empty-ring"><div className="empty-pulse" /></div><p className="empty-title">Cannot Predict the Future</p><p className="empty-body">No data available for future dates.</p></div>) : !hasEvents ? (<motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="empty-ring"><div className="empty-pulse" /></div><p className="empty-title">Awaiting Motion Detection</p><p className="empty-body">No activity recorded. Simulate motion or connect your ESP32 to begin.</p>{!viewingDate && (<div className="sim-btns"><button className="simulate-btn" onClick={handleSimulate} disabled={simulating}>{simulating ? 'Simulating…' : '⚡ Simulate Lights ON'}</button></div>)}</motion.div>) : (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="view-toggle-bar">{['day', 'week', 'month', 'year'].map(v => (<button key={v} className={viewMode === v ? 'active' : ''} onClick={() => setViewMode(v)}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>))}</div>
              <div className="stat-grid">
                <div className="stat-card" onClick={() => { setModalData({ type: 'light', room: displayRoom }); setModalOpen('light') }} style={{ cursor: 'pointer' }}><div className="stat-label">Light Status</div><div className="stat-value">{displayRoom?.is_active ? 'ON' : 'OFF'}</div><StatusBadge on={displayRoom?.is_active} /><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 8 }}>Click to control</div></div>
                <div className="stat-card" onClick={() => { setModalData({ type: 'motion', room: displayRoom }); setModalOpen('motion') }} style={{ cursor: 'pointer' }}><div className="stat-label">Last Motion</div><div className="stat-value" style={{ fontSize: '1.2rem' }}>{displayRoom?.last_motion ? new Date(displayRoom.last_motion).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 8 }}>Click for history</div></div>
                <div className="stat-card" onClick={() => { setModalData({ type: 'occupancy', room: displayRoom }); setModalOpen('occupancy') }} style={{ cursor: 'pointer' }}><div className="stat-label">Room Occupancy</div><div className="stat-value" style={{ fontSize: '1.3rem' }}>{displayRoom?.occupancy ? 'Occupied' : 'Vacant'}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 8 }}>Click for details</div></div>
                <div className="stat-card" onClick={() => { setModalData({ type: 'energy', room: displayRoom }); setModalOpen('energy') }} style={{ cursor: 'pointer' }}><div className="stat-label">Energy Saved Today</div><div className="stat-value">{(displayRoom?.energy_saved_today || 0).toFixed(2)}<span style={{ fontSize: '1rem', marginLeft: 4, color: 'var(--text-3)' }}>kWh</span></div><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 8 }}>Click for breakdown</div></div>
              </div>
              <div className="charts-row">
                <div className="chart-panel" onClick={() => { setModalData({ type: 'chart-hours', labels: weekDays, data: energyHours }); setModalOpen('chart-hours') }} style={{ cursor: 'pointer' }}><div className="chart-panel-head"><span className="chart-panel-title">Daily Light Usage</span><span className="chart-panel-sub">Hours lights were on this week · Click to expand</span></div><Bar data={{ labels: weekDays, datasets: [{ label: 'Hours', data: energyHours, backgroundColor: 'rgba(0,200,150,0.18)', borderColor: 'rgba(0,200,150,0.75)', borderWidth: 1.5, borderRadius: 7 }] }} options={chartOptions} /></div>
                <div className="chart-panel" onClick={() => { setModalData({ type: 'chart-saved', labels: weekDays, data: energySaved }); setModalOpen('chart-saved') }} style={{ cursor: 'pointer' }}><div className="chart-panel-head"><span className="chart-panel-title">Energy Saved</span><span className="chart-panel-sub">kWh saved vs. baseline this week · Click to expand</span></div><Line data={{ labels: weekDays, datasets: [{ label: 'kWh Saved', data: energySaved, borderColor: 'rgba(0,200,150,0.85)', backgroundColor: 'rgba(0,200,150,0.07)', borderWidth: 2, tension: 0.45, pointBackgroundColor: 'var(--green)', pointRadius: 4, fill: true }] }} options={chartOptions} /></div>
              </div>
              <div className="log-panel"><div className="log-panel-head"><span className="chart-panel-title">Event Log</span><span className="live-badge"><span className="live-dot" />Live · {POLL_INTERVAL / 1000}s refresh</span></div><div className="table-scroll"><table className="log-table"><thead><tr><th>Time</th><th>Event</th><th>Room</th><th>Duration</th><th>Status</th></tr></thead><tbody>{(displayRoom?.events || []).slice(0, 20).map((event, i) => (<tr key={i} className={newEventIds.has(event.id) || i === 0 ? 'new-row' : ''}><td>{new Date(event.timestamp).toLocaleTimeString()}</td><td>{event.event_type}</td><td>Room {displayRoom.name}</td><td>{event.duration}</td><td><span className={`status-tag ${event.status}`}>{event.status === 'on' ? 'Active' : 'Ended'}</span></td></tr>))}</tbody></table></div></div>
              {!viewingDate && (<div className="sim-btns" style={{ marginTop: 20 }}><button className="simulate-btn" onClick={handleSimulate} disabled={simulating}>{simulating ? 'Simulating…' : '⚡ Simulate Lights ON'}</button><button className="simulate-btn sim-off" onClick={handleSimulateOff} disabled={simulatingOff}>{simulatingOff ? 'Turning off…' : '🌑 Simulate Lights OFF'}</button></div>)}
            </motion.div>)}
          </>)}
        </main>
      </div>
      <AnimatePresence>
        {modalOpen && modalData && (
          <Modal title={modalData.type === 'light' ? 'Light Control — Room ' + selectedRoom : modalData.type === 'motion' ? 'Motion History — Room ' + selectedRoom : modalData.type === 'occupancy' ? 'Occupancy Details — Room ' + selectedRoom : modalData.type === 'energy' ? 'Energy Breakdown — Room ' + selectedRoom : modalData.type === 'chart-hours' ? 'Daily Light Usage Details' : modalData.type === 'chart-saved' ? 'Energy Savings Analysis' : 'Details'} onClose={() => { setModalOpen(null); setModalData(null) }}>
            {modalData.type === 'light' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: modalData.room?.is_active ? 'rgba(0,200,150,0.08)' : 'rgba(239,68,68,0.06)', borderRadius: 10, border: `1px solid ${modalData.room?.is_active ? 'rgba(0,200,150,0.25)' : 'rgba(239,68,68,0.2)'}` }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: modalData.room?.is_active ? 'var(--green)' : 'var(--red)', animation: modalData.room?.is_active ? 'livePulse 1.8s infinite' : 'none' }} /><span style={{ fontWeight: 600, color: 'var(--text-1)' }}>Lights are currently <strong style={{ color: modalData.room?.is_active ? 'var(--green)' : 'var(--red)' }}>{modalData.room?.is_active ? 'ON' : 'OFF'}</strong></span></div><p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.7 }}>The relay module connected to GPIO 2 controls the 2.5V bulb circuit. When motion is detected by the PIR sensor on GPIO 13, the ESP32 sends HIGH to the relay coil, closing the switch and illuminating the bulb. The auto-off timeout triggers after 7 seconds of no motion to conserve energy.</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button onClick={handleSimulate} disabled={simulating} style={{ padding: '10px 24px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>{simulating ? 'Turning ON…' : 'Turn Lights ON'}</button><button onClick={handleSimulateOff} disabled={simulatingOff} style={{ padding: '10px 24px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 9, fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>{simulatingOff ? 'Turning OFF…' : 'Turn Lights OFF'}</button></div><div style={{ fontSize: '0.78rem', color: 'var(--text-3)', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}><strong>Device:</strong> ESP32 Dev Module · <strong>Relay:</strong> GPIO 2 · <strong>PIR:</strong> GPIO 13 · <strong>Bulb:</strong> 2.5V 3W via 9V battery + 680Ω resistor</div></div>)}
            {modalData.type === 'motion' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.7 }}>The HC-SR501 PIR sensor detects infrared radiation changes caused by moving bodies. When motion is sensed, it outputs HIGH (3.3V) to GPIO 13, triggering the ESP32 to log the event and activate the relay.</p><div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: 4 }}>Recent Motion Events</div><div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>{(modalData.room?.events || []).filter(e => e.status === 'on').slice(0, 10).map((ev, i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: '0.82rem' }}><span style={{ color: 'var(--text-2)' }}>{new Date(ev.timestamp).toLocaleString()}</span><span style={{ color: 'var(--green)', fontWeight: 600 }}>{ev.event_type}</span></div>))}{(modalData.room?.events || []).filter(e => e.status === 'on').length === 0 && (<div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-3)', fontSize: '0.85rem' }}>No motion events recorded yet.</div>)}</div></div>)}
            {modalData.type === 'occupancy' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.7 }}>Occupancy is determined by the PIR sensor state. When the sensor reads HIGH, the room is marked as Occupied. After the timeout period with no motion, the status changes to Vacant and lights automatically turn off.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 6 }}>Current Status</div><div style={{ fontSize: '1.3rem', fontWeight: 600, color: modalData.room?.occupancy ? 'var(--green)' : 'var(--text-1)' }}>{modalData.room?.occupancy ? 'Occupied' : 'Vacant'}</div></div><div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 6 }}>Total Detections</div><div style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-1)' }}>{(modalData.room?.events || []).filter(e => e.status === 'on').length}</div></div></div><div style={{ fontSize: '0.78rem', color: 'var(--text-3)', padding: '10px 14px', background: 'rgba(0,200,150,0.04)', borderRadius: 8, border: '1px solid rgba(0,200,150,0.15)' }}><strong>Tip:</strong> If occupancy seems inaccurate, check the PIR sensor sensitivity potentiometer and ensure the sensor has a clear line of sight across the room.</div></div>)}
            {modalData.type === 'energy' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.7 }}>Energy savings are calculated by comparing actual light usage against an 8-hour daily baseline. The ZAMCELCO rate of ₱{ZAMCELCO_RATE}/kWh is applied to compute peso savings.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 6 }}>Saved Today</div><div style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--green)' }}>{(modalData.room?.energy_saved_today || 0).toFixed(3)} kWh</div></div><div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 6 }}>Peso Value</div><div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#f59e0b' }}>₱{((modalData.room?.energy_saved_today || 0) * ZAMCELCO_RATE).toFixed(2)}</div></div></div><div style={{ padding: '14px', background: 'var(--bg)', borderRadius: 10 }}><div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>Weekly Breakdown</div><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{(modalData.room?.energy_logs || []).slice(-7).map((log, i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-3)' }}>{log.date || weekDays[i]}</span><span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{log.hours_on} hrs · {log.energy_saved?.toFixed(3)} kWh</span></div>))}</div></div></div>)}
            {modalData.type === 'chart-hours' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.7 }}>This chart displays the total hours the lights remained ON per day over the last 7 days.</p><div style={{ height: 300 }}><Bar data={{ labels: modalData.labels, datasets: [{ label: 'Hours', data: modalData.data, backgroundColor: 'rgba(0,200,150,0.25)', borderColor: 'rgba(0,200,150,0.85)', borderWidth: 1.5, borderRadius: 7 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898' } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898' } } } }} /></div></div>)}
            {modalData.type === 'chart-saved' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.7 }}>Energy savings are computed by subtracting actual consumption from an 8-hour daily baseline.</p><div style={{ height: 300 }}><Line data={{ labels: modalData.labels, datasets: [{ label: 'kWh Saved', data: modalData.data, borderColor: 'rgba(0,200,150,0.85)', backgroundColor: 'rgba(0,200,150,0.07)', borderWidth: 2, tension: 0.45, pointBackgroundColor: 'var(--green)', pointRadius: 4, fill: true }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898' } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898' } } } }} /></div></div>)}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DashboardScreen
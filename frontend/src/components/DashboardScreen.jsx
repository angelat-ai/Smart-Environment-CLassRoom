import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchRooms, simulateMotion, simulateLightsOff, fetchRoomHistory } from '../api'
import PlexusLoader from './PlexusLoader'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

const POLL_INTERVAL = 5000

function StatusBadge({ on }) {
  return (
    <span className={`stat-pill ${on ? 'pill-on' : 'pill-off'}`}>
      {on ? 'Active' : 'Inactive'}
    </span>
  )
}

function ESP32Card({ room }) {
  const isConnected = room?.last_motion && (Date.now() - new Date(room.last_motion).getTime()) < 30000
  return (
    <div className="esp32-card">
      <div className="esp32-header">
        <span className="esp32-title">ESP32 Device</span>
        <span className={`esp32-badge ${isConnected ? 'esp32-connected' : 'esp32-offline'}`}>
          <span className="esp32-dot" />
          {isConnected ? 'Connected' : 'Offline'}
        </span>
      </div>
      <div className="esp32-info">
        <div className="esp32-row">
          <span>Room</span><strong>{room?.name || '—'}</strong>
        </div>
        <div className="esp32-row">
          <span>Lights</span><strong style={{ color: room?.is_active ? 'var(--green)' : 'var(--red)' }}>{room?.is_active ? 'ON' : 'OFF'}</strong>
        </div>
        <div className="esp32-row">
          <span>Last Ping</span>
          <strong>{room?.last_motion ? new Date(room.last_motion).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</strong>
        </div>
        <div className="esp32-row">
          <span>Endpoint</span>
          <code style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>POST /api/motion/</code>
        </div>
      </div>
    </div>
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
  const prevEventCount = useRef(0)
  const intervalRef = useRef(null)
  const pollRef = useRef(null)

  const loadRooms = useCallback(async (silent = false) => {
    try {
      const data = await fetchRooms()
      setRooms(prev => {
        const prevRoom = prev.find(r => r.name === selectedRoom)
        const newRoom = data.find(r => r.name === selectedRoom)
        if (prevRoom && newRoom && newRoom.events?.length > prevEventCount.current) {
          const newIds = new Set(newRoom.events.slice(0, newRoom.events.length - prevEventCount.current).map(e => e.id))
          setNewEventIds(newIds)
          setTimeout(() => setNewEventIds(new Set()), 2000)
        }
        if (newRoom) prevEventCount.current = newRoom.events?.length || 0
        return data
      })
      if (data.length > 0 && !selectedRoom) setSelectedRoom(data[0].name)
    } catch {}
    finally { if (!silent) setInitialLoading(false) }
  }, [selectedRoom])

  useEffect(() => { loadRooms() }, [])

  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (!viewingDate) loadRooms(true)
    }, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [viewingDate, loadRooms])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '  |  ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const handleSimulate = async () => {
    if (!selectedRoom) return
    setSimulating(true)
    try {
      await simulateMotion(selectedRoom)
      await loadRooms()
      setViewingDate(null)
    } catch {}
    finally { setSimulating(false) }
  }

  const handleSimulateOff = async () => {
    if (!selectedRoom) return
    setSimulatingOff(true)
    try {
      await simulateLightsOff(selectedRoom)
      await loadRooms()
    } catch {}
    finally { setSimulatingOff(false) }
  }

  const handleDateChange = async (date) => {
    setSelectedDate(date)
    setShowCalendar(false)
    const today = new Date(); today.setHours(0,0,0,0)
    const sel = new Date(date); sel.setHours(0,0,0,0)
    if (sel > today) { setViewingDate('future'); setHistoricalData(null); return }
    if (sel.getTime() === today.getTime()) { setViewingDate(null); setHistoricalData(null); return }
    setHistoryLoading(true)
    setHistoricalData(null)
    setViewingDate('past')
    try {
      const data = await fetchRoomHistory(selectedRoom, date.getFullYear(), date.getMonth() + 1, date.getDate())
      setHistoricalData(data)
    } catch { setHistoricalData({ events: [], energy_logs: [], occupancy: false, energy_saved_today: 0 }) }
    finally { setHistoryLoading(false) }
  }

  const currentRoom = rooms.find(r => r.name === selectedRoom)
  let displayRoom = currentRoom
  let isEmpty = true
  let isFuture = false

  if (viewingDate === 'future') { isFuture = true }
  else if (viewingDate === 'past' && historicalData) {
    displayRoom = { ...currentRoom, ...historicalData }
    isEmpty = !historicalData.events || historicalData.events.length === 0
  } else {
    isEmpty = !currentRoom?.events || currentRoom.events.length === 0
  }

  const hasEvents = !isEmpty && !isFuture

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const energyHours = displayRoom?.energy_logs?.slice(-7).map(l => l.hours_on) || [1.2, 2.5, 3.1, 2.0, 1.8, 0.5, 2.2]
  const energySaved = displayRoom?.energy_logs?.slice(-7).map(l => l.energy_saved) || [15, 18, 22, 20, 17, 12, 19]

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0e1a14', borderColor: 'rgba(0,200,150,0.2)', borderWidth: 1, titleColor: '#fff', bodyColor: '#8fa898' } },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898', font: { size: 11 } } }
    }
  }

  if (initialLoading) return <PlexusLoader />

  return (
    <div className="dashboard-screen">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-sec">SEC</span>
          <span className="brand-label">Smart Environment<br />Classroom</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-link ${activeNav === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveNav('dashboard')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard
          </button>
          <button className={`nav-link ${activeNav === 'rooms' ? 'active' : ''}`} onClick={() => setActiveNav('rooms')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Rooms
          </button>
          <button className={`nav-link ${activeNav === 'logs' ? 'active' : ''}`} onClick={() => setActiveNav('logs')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Event Logs
          </button>
          <button className={`nav-link ${activeNav === 'device' ? 'active' : ''}`} onClick={() => setActiveNav('device')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            ESP32 Device
          </button>
        </nav>
        <button className="sidebar-logout" onClick={onLogout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 7 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </aside>

      <div className="shell">
        <header className="topbar">
          <h1 className="topbar-title">
            {activeNav === 'dashboard' && 'Dashboard'}
            {activeNav === 'rooms' && 'Rooms'}
            {activeNav === 'logs' && 'Event Logs'}
            {activeNav === 'device' && 'ESP32 Device'}
          </h1>
          <div className="topbar-meta">
            <span className="topbar-clock">{clock}</span>
            <button className="calendar-trigger-btn" onClick={() => setShowCalendar(!showCalendar)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
            <select className="room-select" value={selectedRoom} onChange={e => { setSelectedRoom(e.target.value); setViewingDate(null); setHistoricalData(null) }}>
              {rooms.map(room => <option key={room.id} value={room.name}>Room {room.name}</option>)}
            </select>
          </div>
        </header>

        <AnimatePresence>
          {showCalendar && (
            <motion.div className="calendar-popup" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Calendar onChange={handleDateChange} value={selectedDate} />
            </motion.div>
          )}
        </AnimatePresence>

        <main className="dashboard-main">
          {activeNav === 'device' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="device-page">
                <ESP32Card room={currentRoom} />
                <div className="device-guide">
                  <h3 className="device-guide-title">ESP32 Arduino IDE Code</h3>
                  <p className="device-guide-sub">Flash this to your ESP32 once you have the components. Replace WiFi credentials and your server IP.</p>
                  <div className="code-block">
                    <pre>{`#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverURL = "http://YOUR_SERVER_IP:8000/api/motion/";

const int PIR_PIN  = 13;
const int LED_PIN  = 2;
const char* ROOM   = "A";

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
}

void sendEvent(const char* event) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  String body = "{\\"room\\":\\"" + String(ROOM) + "\\",\\"event\\":\\"" + String(event) + "\\",\\"source\\":\\"esp32\\"}";
  int code = http.POST(body);
  Serial.println(code);
  http.end();
}

int lastState = LOW;

void loop() {
  int state = digitalRead(PIR_PIN);
  if (state == HIGH && lastState == LOW) {
    digitalWrite(LED_PIN, HIGH);
    sendEvent("Lights ON");
  }
  if (state == LOW && lastState == HIGH) {
    delay(7000);
    if (digitalRead(PIR_PIN) == LOW) {
      digitalWrite(LED_PIN, LOW);
      sendEvent("Lights OFF");
    }
  }
  lastState = state;
  delay(500);
}`}</pre>
                  </div>
                  <div className="device-pins">
                    <div className="pin-row"><span className="pin-label">PIR VCC</span><span className="pin-val">3.3V or 5V</span></div>
                    <div className="pin-row"><span className="pin-label">PIR GND</span><span className="pin-val">GND</span></div>
                    <div className="pin-row"><span className="pin-label">PIR OUT</span><span className="pin-val">GPIO 13</span></div>
                    <div className="pin-row"><span className="pin-label">Relay IN</span><span className="pin-val">GPIO 2</span></div>
                    <div className="pin-row"><span className="pin-label">Relay VCC</span><span className="pin-val">5V</span></div>
                    <div className="pin-row"><span className="pin-label">Relay GND</span><span className="pin-val">GND</span></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeNav === 'rooms' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="rooms-grid">
                {rooms.map(room => (
                  <div key={room.id} className={`room-card ${room.is_active ? 'room-active' : ''}`} onClick={() => { setSelectedRoom(room.name); setActiveNav('dashboard') }}>
                    <div className="room-card-top">
                      <span className="room-card-name">Room {room.name}</span>
                      <StatusBadge on={room.is_active} />
                    </div>
                    <div className="room-card-stat">
                      <span>{room.occupancy ? 'Occupied' : 'Vacant'}</span>
                      <span>{room.energy_saved_today.toFixed(2)} kWh saved</span>
                    </div>
                    <div className="room-card-motion">
                      Last motion: {room.last_motion ? new Date(room.last_motion).toLocaleTimeString() : 'Never'}
                    </div>
                  </div>
                ))}
                {rooms.length === 0 && <p style={{ color: 'var(--text-3)' }}>No rooms found. Create one from the Django admin or simulate motion.</p>}
              </div>
            </motion.div>
          )}

          {activeNav === 'logs' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="log-panel">
                <div className="log-panel-head">
                  <span className="chart-panel-title">All Event Logs — Room {selectedRoom}</span>
                  <span className="live-badge"><span className="live-dot" />Live</span>
                </div>
                <table className="log-table">
                  <thead><tr><th>Time</th><th>Event</th><th>Room</th><th>Duration</th><th>Status</th></tr></thead>
                  <tbody>
                    {(currentRoom?.events || []).map((event, i) => (
                      <tr key={i} className={i === 0 ? 'new-row' : ''}>
                        <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                        <td>{event.event_type}</td>
                        <td>Room {currentRoom.name}</td>
                        <td>{event.duration}</td>
                        <td><span className={`status-tag ${event.status}`}>{event.status === 'on' ? 'Active' : 'Ended'}</span></td>
                      </tr>
                    ))}
                    {(!currentRoom?.events || currentRoom.events.length === 0) && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>No events yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeNav === 'dashboard' && (
            <>
              {historyLoading ? (
                <div className="loading-state">
                  <div className="dot-loader"><span /><span /><span /></div>
                  <p>Loading history…</p>
                </div>
              ) : isFuture ? (
                <div className="empty-state">
                  <div className="empty-ring"><div className="empty-pulse" /></div>
                  <p className="empty-title">Cannot Predict the Future</p>
                  <p className="empty-body">No data available for future dates.</p>
                </div>
              ) : !hasEvents ? (
                <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="empty-ring"><div className="empty-pulse" /></div>
                  <p className="empty-title">Awaiting Motion Detection</p>
                  <p className="empty-body">No activity recorded for this room. Simulate motion or connect your ESP32 to begin.</p>
                  {!viewingDate && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                      <button className="simulate-btn" onClick={handleSimulate} disabled={simulating}>
                        {simulating ? 'Simulating…' : '⚡ Simulate Lights ON'}
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="stat-grid">
                    <div className="stat-card">
                      <div className="stat-label">Light Status</div>
                      <div className="stat-value">{displayRoom?.is_active ? 'ON' : 'OFF'}</div>
                      <StatusBadge on={displayRoom?.is_active} />
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Last Motion</div>
                      <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                        {displayRoom?.last_motion ? new Date(displayRoom.last_motion).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Room Occupancy</div>
                      <div className="stat-value" style={{ fontSize: '1.3rem' }}>{displayRoom?.occupancy ? 'Occupied' : 'Vacant'}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Energy Saved Today</div>
                      <div className="stat-value">{(displayRoom?.energy_saved_today || 0).toFixed(2)}<span style={{ fontSize: '1rem', marginLeft: 4, color: 'var(--text-3)' }}>kWh</span></div>
                    </div>
                  </div>

                  <div className="charts-row">
                    <div className="chart-panel">
                      <div className="chart-panel-head">
                        <span className="chart-panel-title">Daily Light Usage</span>
                        <span className="chart-panel-sub">Hours lights were on this week</span>
                      </div>
                      <Bar data={{ labels: weekDays, datasets: [{ label: 'Hours', data: energyHours, backgroundColor: 'rgba(0,200,150,0.18)', borderColor: 'rgba(0,200,150,0.75)', borderWidth: 1.5, borderRadius: 7 }] }} options={chartOptions} />
                    </div>
                    <div className="chart-panel">
                      <div className="chart-panel-head">
                        <span className="chart-panel-title">Energy Saved</span>
                        <span className="chart-panel-sub">kWh saved vs. baseline this week</span>
                      </div>
                      <Line data={{ labels: weekDays, datasets: [{ label: 'kWh Saved', data: energySaved, borderColor: 'rgba(0,200,150,0.85)', backgroundColor: 'rgba(0,200,150,0.07)', borderWidth: 2, tension: 0.45, pointBackgroundColor: 'rgba(0,200,150,1)', pointRadius: 4, fill: true }] }} options={chartOptions} />
                    </div>
                  </div>

                  <div className="log-panel">
                    <div className="log-panel-head">
                      <span className="chart-panel-title">Event Log</span>
                      <span className="live-badge"><span className="live-dot" />Live · Auto-refresh {POLL_INTERVAL/1000}s</span>
                    </div>
                    <table className="log-table">
                      <thead><tr><th>Time</th><th>Event</th><th>Room</th><th>Duration</th><th>Status</th></tr></thead>
                      <tbody>
                        {(displayRoom?.events || []).slice(0, 20).map((event, i) => (
                          <tr key={i} className={newEventIds.has(event.id) || i === 0 ? 'new-row' : ''}>
                            <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                            <td>{event.event_type}</td>
                            <td>Room {displayRoom.name}</td>
                            <td>{event.duration}</td>
                            <td><span className={`status-tag ${event.status}`}>{event.status === 'on' ? 'Active' : 'Ended'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!viewingDate && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                      <button className="simulate-btn" onClick={handleSimulate} disabled={simulating}>
                        {simulating ? 'Simulating…' : '⚡ Simulate Lights ON'}
                      </button>
                      <button className="simulate-btn" onClick={handleSimulateOff} disabled={simulatingOff} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
                        {simulatingOff ? 'Turning off…' : '🌑 Simulate Lights OFF'}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default DashboardScreen
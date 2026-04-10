import React, { useState, useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { fetchRooms, simulateMotion, fetchRoomHistory } from '../api'
import PlexusLoader from './PlexusLoader'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function DashboardScreen({ onLogout }) {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('A')
  const [initialLoading, setInitialLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [clock, setClock] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewingDate, setViewingDate] = useState(null)
  const [historicalData, setHistoricalData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const intervalRef = useRef(null)

  const loadRooms = async () => {
    try {
      const data = await fetchRooms()
      setRooms(data)
      if (data.length > 0 && !selectedRoom) setSelectedRoom(data[0].name)
    } catch (error) {
      console.error('Failed to fetch rooms:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    loadRooms()
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const d = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      setClock(`${d}  |  ${t}`)
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
    } catch (error) {
      console.error('Simulation failed:', error)
    } finally {
      setSimulating(false)
    }
  }

  const handleDateChange = async (date) => {
    setSelectedDate(date)
    setShowCalendar(false)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selected = new Date(date)
    selected.setHours(0, 0, 0, 0)

    if (selected > today) {
      setViewingDate('future')
      setHistoricalData(null)
      return
    }

    if (selected.getTime() === today.getTime()) {
      setViewingDate(null)
      setHistoricalData(null)
      return
    }

    setHistoryLoading(true)
    setHistoricalData(null)
    setViewingDate('past')
    try {
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      const data = await fetchRoomHistory(selectedRoom, year, month, day)
      setHistoricalData(data)
    } catch (error) {
      setHistoricalData({ events: [], energy_logs: [], occupancy: false, energy_saved_today: 0 })
    } finally {
      setHistoryLoading(false)
    }
  }

  const currentRoom = rooms.find(r => r.name === selectedRoom)

  let displayRoom = currentRoom
  let isEmpty = true
  let isFuture = false

  if (viewingDate === 'future') {
    isFuture = true
  } else if (viewingDate === 'past' && historicalData) {
    displayRoom = { ...currentRoom, ...historicalData }
    isEmpty = !historicalData.events || historicalData.events.length === 0
  } else {
    isEmpty = !currentRoom?.events || currentRoom.events.length === 0
  }

  const hasEvents = !isEmpty && !isFuture

  if (initialLoading) {
    return <PlexusLoader />
  }

  return (
    <div className="dashboard-screen">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-sec">SEC</span>
          <span className="brand-label">Smart Environment<br />Classroom</span>
        </div>
        <nav className="sidebar-nav">
          <a className="nav-link active">Dashboard</a>
        </nav>
        <button className="sidebar-logout" onClick={onLogout}>Logout</button>
      </aside>

      <div className="shell">
        <header className="topbar">
          <h1 className="topbar-title">Dashboard</h1>
          <div className="topbar-meta">
            <span className="topbar-clock">{clock}</span>
            <button className="calendar-trigger-btn" onClick={() => setShowCalendar(!showCalendar)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
            <select className="room-select" value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
              {rooms.map(room => (
                <option key={room.id} value={room.name}>Room {room.name}</option>
              ))}
            </select>
          </div>
        </header>

        {showCalendar && (
          <div className="calendar-popup">
            <Calendar onChange={handleDateChange} value={selectedDate} />
          </div>
        )}

        <main className="dashboard-main">
          {historyLoading ? (
            <div className="loading-state">
              <div className="dot-loader"><span></span><span></span><span></span></div>
              <p>Loading history...</p>
            </div>
          ) : (
            <>
              {isFuture ? (
                <div className="empty-state">
                  <div className="empty-ring">
                    <div className="empty-pulse"></div>
                  </div>
                  <p className="empty-title">Cannot Predict the Future</p>
                  <p className="empty-body">No data available for future dates.</p>
                </div>
              ) : !hasEvents ? (
                <div className="empty-state">
                  <div className="empty-ring">
                    <div className="empty-pulse"></div>
                  </div>
                  <p className="empty-title">Awaiting Motion Detection</p>
                  <p className="empty-body">No activity has been recorded for this date.</p>
                  {!viewingDate && (
                    <button className="simulate-btn" onClick={handleSimulate} disabled={simulating}>
                      {simulating ? 'Simulating...' : 'Simulate Motion Detection'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="stat-grid">
                    <div className="stat-card">
                      <div className="stat-label">Light Status</div>
                      <div className="stat-value">{displayRoom.events[0]?.event_type === 'Lights ON' ? 'ON' : 'OFF'}</div>
                      <div className={`stat-pill ${displayRoom.events[0]?.event_type === 'Lights ON' ? 'pill-on' : 'pill-off'}`}>
                        {displayRoom.events[0]?.event_type === 'Lights ON' ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Last Motion Detected</div>
                      <div className="stat-value">{displayRoom.last_motion ? new Date(displayRoom.last_motion).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Room Occupancy</div>
                      <div className="stat-value">{displayRoom.occupancy ? 'Occupied' : 'Vacant'}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Energy Saved Today</div>
                      <div className="stat-value">{displayRoom.energy_saved_today.toFixed(1)} kWh</div>
                    </div>
                  </div>

                  <div className="charts-row">
                    <div className="chart-panel">
                      <div className="chart-panel-head">
                        <span className="chart-panel-title">Daily Light Usage</span>
                        <span className="chart-panel-sub">Hours lights were on this week</span>
                      </div>
                      <Bar
                        data={{
                          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                          datasets: [{
                            label: 'Hours',
                            data: displayRoom.energy_logs?.slice(-5).map(log => log.hours_on) || [1.2, 2.5, 3.1, 2.0, 1.8],
                            backgroundColor: 'rgba(0,200,150,0.18)',
                            borderColor: 'rgba(0,200,150,0.75)',
                            borderWidth: 1.5,
                            borderRadius: 7,
                          }]
                        }}
                        options={{
                          responsive: true,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898' } },
                            y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898' } }
                          }
                        }}
                      />
                    </div>
                    <div className="chart-panel">
                      <div className="chart-panel-head">
                        <span className="chart-panel-title">Weekly Energy Saved</span>
                        <span className="chart-panel-sub">Percentage saved vs. baseline</span>
                      </div>
                      <Line
                        data={{
                          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                          datasets: [{
                            label: '% Saved',
                            data: displayRoom.energy_logs?.slice(-4).map(log => log.energy_saved) || [15, 18, 22, 20],
                            borderColor: 'rgba(0,200,150,0.85)',
                            backgroundColor: 'rgba(0,200,150,0.07)',
                            borderWidth: 2,
                            tension: 0.45,
                            pointBackgroundColor: 'rgba(0,200,150,1)',
                            pointRadius: 4,
                            fill: true
                          }]
                        }}
                        options={{
                          responsive: true,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898' } },
                            y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8fa898' } }
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="log-panel">
                    <div className="log-panel-head">
                      <span className="chart-panel-title">Event Log</span>
                      <span className="live-badge"><span className="live-dot"></span>Live</span>
                    </div>
                    <table className="log-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Event</th>
                          <th>Room</th>
                          <th>Duration</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRoom.events.slice(0, 20).map((event, i) => (
                          <tr key={i} className={i === 0 ? 'new-row' : ''}>
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
                    <button className="simulate-btn" onClick={handleSimulate} disabled={simulating} style={{ marginTop: '20px' }}>
                      Simulate Motion Again
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default DashboardScreen
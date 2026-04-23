import React, { useState, useEffect } from 'react'
import PlexusLoader from './components/PlexusLoader'
import LoginScreen from './components/LoginScreen'
import DashboardScreen from './components/DashboardScreen'

function App() {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2800)
    return () => clearTimeout(timer)
  }, [])

  if (loading) return <PlexusLoader />
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />
  return <DashboardScreen onLogout={() => setAuthed(false)} />
}

export default App
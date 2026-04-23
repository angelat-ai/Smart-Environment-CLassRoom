import React, { useState, useEffect } from 'react'
import PlexusLoader from './components/PlexusLoader'
import LoginScreen from './components/LoginScreen'
import DashboardScreen from './components/DashboardScreen'
import { isAuthenticated, logoutUser } from './api'

function App() {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthed(isAuthenticated())
      setLoading(false)
    }, 2800)
    return () => clearTimeout(timer)
  }, [])

  const handleLogin = () => setAuthed(true)
  const handleLogout = () => {
    logoutUser()
    setAuthed(false)
  }

  if (loading) return <PlexusLoader />
  if (!authed) return <LoginScreen onLogin={handleLogin} />
  return <DashboardScreen onLogout={handleLogout} />
}

export default App
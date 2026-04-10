import React, { useState, useEffect } from 'react'
import PlexusLoader from './components/PlexusLoader'
import LoginScreen from './components/LoginScreen'
import DashboardScreen from './components/DashboardScreen'

function App() {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleLogin = () => setIsAuthenticated(true)
  const handleLogout = () => setIsAuthenticated(false)

  if (loading) return <PlexusLoader />
  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />
  return <DashboardScreen onLogout={handleLogout} />
}

export default App
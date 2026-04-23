import React, { useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { loginUser, registerUser } from '../api'

function DraggableBulb({ isOn, setIsOn }) {
  const y = useMotionValue(0)
  const bulbScale = useTransform(y, [0, 60], [1, 1.15])
  const bulbRotate = useTransform(y, [0, 60], [0, 10])
  const cordLength = useTransform(y, [0, 60], [40, 90])

  const handleDragEnd = () => {
    const currentY = y.get()
    if (currentY > 40) {
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 20 })
      setIsOn(true)
    } else {
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 25 })
      setIsOn(false)
    }
  }

  return (
    <>
      <div className="bulb-wrapper">
        <motion.div className="bulb-cord" style={{ height: cordLength }} />
        <motion.div
          className={`bulb-draggable ${isOn ? 'on' : ''}`}
          style={{ y, scale: bulbScale, rotate: bulbRotate }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 70 }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          whileTap={{ cursor: 'grabbing' }}
        >
          <div className="bulb-glass">
            <div className="bulb-filament" />
            <div className="bulb-glow" />
          </div>
          <div className="bulb-base" />
        </motion.div>
      </div>
      {isOn && <div className="light-overlay" />}
    </>
  )
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [bulbOn, setBulbOn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('Username and password are required.')
      return
    }
    setLoading(true)
    try {
      await loginUser(username, password)
      setShowWelcome(true)
      setTimeout(() => onLogin(), 1800)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (!username || !email || !password || !confirmPassword) {
      setError('All fields are required.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await registerUser({ username, email, password, confirm_password: confirmPassword, first_name: firstName, last_name: lastName })
      setShowWelcome(true)
      setTimeout(() => onLogin(), 1800)
    } catch (err) {
      const data = err.response?.data
      setError(typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  if (showWelcome) {
    return (
      <div className="auth-screen">
        <div className="auth-panel">
          <div className="auth-left">
            <span className="auth-sec">SEC</span>
            <span className="auth-name">Smart Environment Classroom</span>
            <p className="auth-desc">Intelligent lighting, real-time occupancy, and energy insights — all in one place.</p>
            <div style={{ marginTop: '40px' }}><DraggableBulb isOn={bulbOn} setIsOn={setBulbOn} /></div>
          </div>
          <div className="auth-right">
            <div className="auth-box">
              <p className="welcome-greeting">Welcome back,</p>
              <h2 className="welcome-name">{firstName || username || 'Admin'}</h2>
              <p className="welcome-sub">Preparing your dashboard…</p>
              <div className="dot-loader"><span /><span /><span /></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-left">
          <span className="auth-sec">SEC</span>
          <span className="auth-name">Smart Environment Classroom</span>
          <p className="auth-desc">Intelligent lighting, real-time occupancy, and energy insights — all in one place.</p>
          <div style={{ marginTop: '40px' }}><DraggableBulb isOn={bulbOn} setIsOn={setBulbOn} /></div>
        </div>
        <div className="auth-right">
          <div className="auth-box">
            {mode === 'login' && (
              <>
                <h2 className="form-heading">Sign In</h2>
                <p className="form-sub">Access your classroom dashboard</p>
                <form onSubmit={handleLogin}>
                  <div className="field-group">
                    <label className="field-label">Username</label>
                    <input className="field-input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Password</label>
                    <input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
                  </div>
                  <div className="field-row">
                    <label className="check-label">
                      <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                      Remember me
                    </label>
                    <button type="button" className="text-btn" onClick={() => { setMode('forgot'); setError('') }}>Forgot password?</button>
                  </div>
                  {error && <div className="error-msg">{error}</div>}
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
                  <p className="switch-text">No account? <button type="button" className="text-btn" onClick={() => { setMode('register'); setError('') }}>Create one</button></p>
                </form>
              </>
            )}

            {mode === 'register' && (
              <>
                <h2 className="form-heading">Create Account</h2>
                <p className="form-sub">Join the SEC dashboard</p>
                <form onSubmit={handleRegister}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="field-group">
                      <label className="field-label">First Name</label>
                      <input className="field-input" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Juan" />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Last Name</label>
                      <input className="field-input" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="dela Cruz" />
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Username</label>
                    <input className="field-input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="juandelacruz" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Email</label>
                    <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@school.edu" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Password</label>
                    <input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Confirm Password</label>
                    <input className="field-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
                  </div>
                  {error && <div className="error-msg">{error}</div>}
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Creating…' : 'Create Account'}</button>
                  <p className="switch-text">Have an account? <button type="button" className="text-btn" onClick={() => { setMode('login'); setError('') }}>Sign in</button></p>
                </form>
              </>
            )}

            {mode === 'forgot' && (
              <>
                <h2 className="form-heading">Reset Password</h2>
                <p className="form-sub">Contact your system admin to reset your password.</p>
                <p className="switch-text" style={{ marginTop: '20px' }}>
                  <button type="button" className="text-btn" onClick={() => { setMode('login'); setError('') }}>← Back to Sign In</button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginScreen
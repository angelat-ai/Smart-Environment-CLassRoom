import React, { useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

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
  const [showWelcome, setShowWelcome] = useState(false)
  const [bulbOn, setBulbOn] = useState(false)

  const handleLogin = (e) => {
    e.preventDefault()
    setShowWelcome(true)
    setTimeout(() => onLogin(), 1600)
  }

  if (showWelcome) {
    return (
      <div className="auth-screen">
        <div className="auth-panel">
          <div className="auth-left">
            <span className="auth-sec">SEC</span>
            <span className="auth-name">Smart Environment Classroom</span>
            <p className="auth-desc">Intelligent lighting, real-time occupancy, and energy insights all in one place.</p>
            <div style={{ marginTop: '40px' }}><DraggableBulb isOn={bulbOn} setIsOn={setBulbOn} /></div>
          </div>
          <div className="auth-right">
            <div className="auth-box">
              <p className="welcome-greeting">Welcome,</p>
              <h2 className="welcome-name">Admin</h2>
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
            <h2 className="form-heading">Sign In</h2>
            <p className="form-sub">Access your classroom dashboard</p>
            <form onSubmit={handleLogin}>
              <div className="field-group">
                <label className="field-label">Username</label>
                <input className="field-input" type="text" placeholder="admin" defaultValue="admin" />
              </div>
              <div className="field-group">
                <label className="field-label">Password</label>
                <input className="field-input" type="password" placeholder="password" defaultValue="password" />
              </div>
              <button type="submit" className="submit-btn">Sign In</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginScreen
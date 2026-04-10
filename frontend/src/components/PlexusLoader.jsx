import React, { useRef, useEffect } from 'react'

function PlexusLoader() {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W, H, nodes = []

    const resize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }

    const makeNode = () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 1.5 + 0.5
    })

    const loop = () => {
      ctx.clearRect(0, 0, W, H)
      nodes.forEach(n => {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > W) n.vx *= -1
        if (n.y < 0 || n.y > H) n.vy *= -1
      })
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 150) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(0,200,150,${(1 - d / 150) * 0.28})`
            ctx.lineWidth = 0.5
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }
      nodes.forEach(n => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,200,150,0.45)'
        ctx.fill()
      })
      animationRef.current = requestAnimationFrame(loop)
    }

    resize()
    const count = Math.floor((W * H) / 12000)
    nodes = Array.from({ length: count }, makeNode)
    loop()

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="loader-container">
      <canvas ref={canvasRef} className="loader-canvas" />
      <div className="loader-content">
        <div className="loader-brand">SEC</div>
        <div className="loader-def">Smart Environment Classroom</div>
        <div className="loader-bar-track">
          <div className="loader-bar-fill"></div>
        </div>
      </div>
    </div>
  )
}

export default PlexusLoader
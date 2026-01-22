import { useEffect, useRef } from 'react'

const ButterflyBackground = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId = null
    let particles = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    const initParticles = () => {
      particles = []
      const particleCount = 3

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: 0.01 + Math.random() * 0.1,
          y: 0.01 + Math.random() * 0.1,
          z: 0.01 + Math.random() * 0.1,
          color: i === 0 ? '#0070F3' : i === 1 ? '#00aaff' : '#00ffea',
          speed: 0.005 + Math.random() * 0.005,
          trail: [],
          maxTrail: 800
        })
      }
    }

    const lorenz = (x, y, z, s = 10, r = 28, b = 8/3, dt = 0.008) => {
      const dx = s * (y - x)
      const dy = x * (r - z) - y
      const dz = x * y - b * z
      return {
        x: x + dx * dt,
        y: y + dy * dt,
        z: z + dz * dt
      }
    }

    const project = (x, y, z, width, height) => {
      const scale = Math.min(width, height) / 60
      const x2d = width / 2 + x * scale + 150
      const y2d = height / 2 + z * scale
      return { x: x2d, y: y2d }
    }

    const animate = () => {
      const width = canvas.width
      const height = canvas.height

      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
      ctx.fillRect(0, 0, width, height)

      particles.forEach((p, pi) => {
        for (let i = 0; i < 5; i++) {
          const next = lorenz(p.x, p.y, p.z)
          p.x = next.x
          p.y = next.y
          p.z = next.z

          const pos = project(p.x, p.y, p.z, width, height)
          p.trail.push({ x: pos.x, y: pos.y })

          if (p.trail.length > p.maxTrail) {
            p.trail.shift()
          }
        }

        ctx.beginPath()
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'

        if (p.trail.length > 1) {
          for (let i = 1; i < p.trail.length; i++) {
            const alpha = i / p.trail.length
            ctx.globalAlpha = alpha * 0.7
            ctx.beginPath()
            ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y)
            ctx.lineTo(p.trail[i].x, p.trail[i].y)
            ctx.stroke()
          }
        }

        if (p.trail.length > 0) {
          const head = p.trail[p.trail.length - 1]
          ctx.globalAlpha = 1
          ctx.beginPath()
          ctx.arc(head.x, head.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = p.color
          ctx.fill()

          ctx.beginPath()
          ctx.arc(head.x, head.y, 8, 0, Math.PI * 2)
          ctx.strokeStyle = p.color
          ctx.globalAlpha = 0.3
          ctx.stroke()
        }
      })

      ctx.globalAlpha = 1
      animationId = requestAnimationFrame(animate)
    }

    resize()
    animate()

    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ background: '#000000' }}
    />
  )
}

export default ButterflyBackground

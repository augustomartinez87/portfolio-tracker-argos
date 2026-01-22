import { useEffect, useRef } from 'react'

const ButterflyBackground = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId = null
    let butterflies = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    class Butterfly {
      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = 15 + Math.random() * 20
        this.speedX = (Math.random() - 0.5) * 2
        this.speedY = (Math.random() - 0.5) * 1
        this.wingPhase = Math.random() * Math.PI * 2
        this.wingSpeed = 0.15 + Math.random() * 0.1
        this.opacity = 0.3 + Math.random() * 0.4
        this.color = '#FFFFFF'
        this.phase = this.wingPhase
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY

        if (this.x < -50) this.x = canvas.width + 50
        if (this.x > canvas.width + 50) this.x = -50
        if (this.y < -50) this.y = canvas.height + 50
        if (this.y > canvas.height + 50) this.y = -50

        this.phase += this.wingSpeed
      }

      draw(ctx) {
        const wingAngle = Math.sin(this.phase) * 0.5
        const wingFlap = Math.sin(this.phase) * this.size * 0.8

        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.strokeStyle = this.color
        ctx.lineWidth = 1.5
        ctx.globalAlpha = this.opacity

        // Body (line)
        ctx.beginPath()
        ctx.moveTo(0, -this.size * 0.3)
        ctx.lineTo(0, this.size * 0.3)
        ctx.stroke()

        // Antennae
        ctx.beginPath()
        ctx.moveTo(0, -this.size * 0.3)
        ctx.lineTo(-this.size * 0.2, -this.size * 0.5)
        ctx.moveTo(0, -this.size * 0.3)
        ctx.lineTo(this.size * 0.2, -this.size * 0.5)
        ctx.stroke()

        // Left wing
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(
          -this.size * 1.5 - wingFlap,
          -this.size * 0.2,
          -this.size * 1.2,
          -this.size * 0.8
        )
        ctx.quadraticCurveTo(
          -this.size * 0.8,
          -this.size * 0.5,
          0,
          0
        )
        ctx.stroke()

        // Left lower wing
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(
          -this.size * 1.3 + wingFlap * 0.5,
          this.size * 0.3,
          -this.size * 1.0,
          this.size * 0.7
        )
        ctx.quadraticCurveTo(
          -this.size * 0.5,
          this.size * 0.5,
          0,
          0
        )
        ctx.stroke()

        // Right wing
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(
          this.size * 1.5 + wingFlap,
          -this.size * 0.2,
          this.size * 1.2,
          -this.size * 0.8
        )
        ctx.quadraticCurveTo(
          this.size * 0.8,
          -this.size * 0.5,
          0,
          0
        )
        ctx.stroke()

        // Right lower wing
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(
          this.size * 1.3 - wingFlap * 0.5,
          this.size * 0.3,
          this.size * 1.0,
          this.size * 0.7
        )
        ctx.quadraticCurveTo(
          this.size * 0.5,
          this.size * 0.5,
          0,
          0
        )
        ctx.stroke()

        ctx.restore()
      }
    }

    const init = () => {
      butterflies = []
      const count = Math.min(8, Math.floor((canvas.width * canvas.height) / 200000))
      for (let i = 0; i < count; i++) {
        butterflies.push(new Butterfly())
      }
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      butterflies.forEach(b => {
        b.update()
        b.draw(ctx)
      })

      animationId = requestAnimationFrame(animate)
    }

    resize()
    init()
    animate()

    window.addEventListener('resize', () => {
      resize()
      init()
    })

    return () => {
      window.removeEventListener('resize', resize)
      if (animationId) cancelAnimationFrame(animationId)
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

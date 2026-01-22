import { useEffect, useRef, useState, useCallback } from 'react'

const ButterflyBackground = () => {
  const canvasRef = useRef(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId = null
    let butterflies = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initButterflies()
    }

    const initButterflies = () => {
      butterflies = []
      const count = Math.max(5, Math.min(12, Math.floor((canvas.width * canvas.height) / 150000)))
      for (let i = 0; i < count; i++) {
        butterflies.push(new Butterfly(canvas.width, canvas.height))
      }
    }

    class Butterfly {
      constructor(cw, ch) {
        this.x = Math.random() * cw
        this.y = Math.random() * ch
        this.size = 12 + Math.random() * 18
        this.speedX = (Math.random() - 0.5) * 1.5
        this.speedY = (Math.random() - 0.5) * 0.8
        this.wingPhase = Math.random() * Math.PI * 2
        this.wingSpeed = 0.12 + Math.random() * 0.08
        this.opacity = 0.25 + Math.random() * 0.35
        this.color = '#FFFFFF'
      }

      update(cw, ch) {
        this.x += this.speedX
        this.y += this.speedY

        if (this.x < -60) this.x = cw + 60
        if (this.x > cw + 60) this.x = -60
        if (this.y < -60) this.y = ch + 60
        if (this.y > ch + 60) this.y = -60

        this.wingPhase += this.wingSpeed
      }

      draw(ctx) {
        const wingFlap = Math.sin(this.wingPhase) * this.size * 0.6

        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.strokeStyle = this.color
        ctx.lineWidth = 1.2
        ctx.globalAlpha = this.opacity
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()
        ctx.moveTo(0, -this.size * 0.25)
        ctx.lineTo(0, this.size * 0.25)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, -this.size * 0.25)
        ctx.lineTo(-this.size * 0.15, -this.size * 0.45)
        ctx.moveTo(0, -this.size * 0.25)
        ctx.lineTo(this.size * 0.15, -this.size * 0.45)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(
          -this.size * 1.3 - wingFlap,
          -this.size * 0.15,
          -this.size * 1.1,
          -this.size * 0.7
        )
        ctx.quadraticCurveTo(
          -this.size * 0.7,
          -this.size * 0.45,
          0,
          0
        )
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(
          -this.size * 1.1 + wingFlap * 0.4,
          this.size * 0.25,
          -this.size * 0.9,
          this.size * 0.6
        )
        ctx.quadraticCurveTo(
          -this.size * 0.45,
          this.size * 0.4,
          0,
          0
        )
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(
          this.size * 1.3 + wingFlap,
          -this.size * 0.15,
          this.size * 1.1,
          -this.size * 0.7
        )
        ctx.quadraticCurveTo(
          this.size * 0.7,
          -this.size * 0.45,
          0,
          0
        )
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(
          this.size * 1.1 - wingFlap * 0.4,
          this.size * 0.25,
          this.size * 0.9,
          this.size * 0.6
        )
        ctx.quadraticCurveTo(
          this.size * 0.45,
          this.size * 0.4,
          0,
          0
        )
        ctx.stroke()

        ctx.restore()
      }
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      butterflies.forEach(b => {
        b.update(canvas.width, canvas.height)
        b.draw(ctx)
      })

      animationId = requestAnimationFrame(animate)
    }

    resize()
    animate()

    const handleResize = () => {
      resize()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isClient])

  if (!isClient) {
    return <div className="fixed inset-0 -z-10 bg-black" />
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ background: '#000000' }}
    />
  )
}

export default ButterflyBackground

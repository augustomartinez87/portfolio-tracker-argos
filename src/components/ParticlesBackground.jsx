import { useEffect, useRef, useState } from 'react'

const ParticlesBackground = () => {
  const containerRef = useRef(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let retryCount = 0
    const maxRetries = 10

    const initParticles = async () => {
      if (!containerRef.current) return

      if (!window.tsParticles) {
        retryCount++
        if (retryCount < maxRetries) {
          setTimeout(initParticles, 300)
        } else {
          setHasError(true)
        }
        return
      }

      try {
        await window.tsParticles.load({
          id: 'tsparticles',
          container: containerRef.current,
          options: {
            background: {
              color: '#000000'
            },
            fpsLimit: 60,
            particles: {
              number: {
                value: 50,
                density: {
                  enable: true,
                  area: 900
                }
              },
              color: {
                value: '#0070F3'
              },
              shape: {
                type: 'circle'
              },
              opacity: {
                value: 0.6
              },
              size: {
                value: { min: 2, max: 4 }
              },
              move: {
                enable: true,
                speed: 1.5,
                direction: 'none',
                random: true,
                outModes: {
                  default: 'bounce'
                }
              },
              links: {
                enable: true,
                color: '#0070F3',
                opacity: 0.4,
                width: 2,
                distance: 150
              }
            },
            interactivity: {
              detectOn: 'canvas',
              events: {
                onHover: {
                  enable: true,
                  mode: 'grab'
                },
                onClick: {
                  enable: true,
                  mode: 'push'
                }
              },
              modes: {
                grab: {
                  distance: 180,
                  links: {
                    opacity: 0.7
                  }
                },
                push: {
                  quantity: 3
                }
              }
            }
          }
        })
      } catch (error) {
        console.warn('tsParticles error:', error)
        setHasError(true)
      }
    }

    initParticles()

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [])

  if (hasError) {
    return (
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-gray-900 via-black to-gray-900" />
    )
  }

  return (
    <div
      id="tsparticles"
      ref={containerRef}
      className="fixed inset-0 -z-10"
      style={{ background: '#000000' }}
    />
  )
}

export default ParticlesBackground

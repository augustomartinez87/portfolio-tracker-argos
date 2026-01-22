import { useEffect, useRef, useState } from 'react'

const ParticlesBackground = () => {
  const containerRef = useRef(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let isMounted = true
    let particlesInstance = null

    const initParticles = async () => {
      if (!containerRef.current || !window.tsParticles) {
        return
      }

      const container = containerRef.current
      if (container.innerHTML) {
        return
      }

      try {
        await window.tsParticles.load({
          id: 'tsparticles-container',
          container: container,
          options: {
            background: {
              color: '#000000'
            },
            fpsLimit: 60,
            pauseOnBlur: true,
            retinaDetect: true,
            particles: {
              number: {
                value: 60,
                density: {
                  enable: true,
                  area: 800
                }
              },
              color: {
                value: ['#0070F3', '#3B82F6', '#60A5FA', '#FFFFFF']
              },
              shape: {
                type: 'circle'
              },
              opacity: {
                value: 0.7,
                random: true
              },
              size: {
                value: { min: 2, max: 4 },
                random: true
              },
              move: {
                enable: true,
                speed: 1.5,
                direction: 'none',
                random: true,
                outModes: {
                  default: 'bounce'
                },
                attract: {
                  enable: true,
                  distance: 150,
                  rotate: {
                    x: 2000,
                    y: 2000
                  }
                }
              },
              links: {
                enable: true,
                color: '#0070F3',
                opacity: 0.5,
                width: 2.5,
                distance: 160
              }
            },
            interactivity: {
              detectOn: 'window',
              events: {
                onHover: {
                  enable: true,
                  mode: 'grab',
                  distance: 180
                },
                onClick: {
                  enable: true,
                  mode: 'push'
                },
                resize: {
                  enable: true,
                  delay: 150
                }
              },
              modes: {
                grab: {
                  distance: 200,
                  links: {
                    opacity: 0.8
                  }
                },
                push: {
                  quantity: 4
                },
                repulse: {
                  distance: 200,
                  duration: 0.4
                }
              }
            }
          }
        })

        if (isMounted) {
          setLoaded(true)
        }
      } catch (error) {
        console.warn('tsParticles init error:', error)
      }
    }

    const checkAndInit = () => {
      if (window.tsParticles) {
        initParticles()
      } else {
        setTimeout(checkAndInit, 200)
      }
    }

    checkAndInit()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div
      id="tsparticles-container"
      ref={containerRef}
      className="fixed inset-0 -z-10 pointer-events-none bg-black"
    />
  )
}

export default ParticlesBackground

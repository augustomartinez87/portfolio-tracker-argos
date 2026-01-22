import { useEffect, useRef } from 'react'

const ParticlesBackground = () => {
  const containerRef = useRef(null)

  useEffect(() => {
    const loadParticles = async () => {
      if (!window.tsParticles || !containerRef.current) return

      await window.tsParticles.load({
        id: 'tsparticles',
        container: containerRef.current,
        options: {
          background: {
            color: '#000000'
          },
          fpsLimit: 60,
          pauseOnBlur: true,
          retinaDetect: true,
          particles: {
            number: {
              value: 80,
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
              value: 0.8,
              random: true,
              animation: {
                enable: true,
                speed: 1,
                minimumValue: 0.3,
                destroy: 'none'
              }
            },
            size: {
              value: { min: 2, max: 5 },
              random: true,
              animation: {
                enable: true,
                speed: 2,
                minimumValue: 1,
                destroy: 'none'
              }
            },
            move: {
              enable: true,
              speed: 2,
              direction: 'none',
              random: true,
              straight: false,
              outModes: {
                default: 'bounce'
              },
              attract: {
                enable: true,
                distance: 200,
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
              width: 3,
              distance: 180,
              random: true
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
              onDiv: {
                enable: false
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
                quantity: 4,
                groups: []
              },
              repulse: {
                distance: 200,
                duration: 0.4,
                factor: 100,
                speed: 1,
                maxSpeed: 50,
                easing: 'easeOutQuad'
              },
              bubble: {
                distance: 400,
                duration: 2,
                opacity: 0.8,
                size: 0,
                groups: []
              }
            }
          },
          polygons: {
            enable: false
          },
          presets: {
            basic: {
              links: {
                enable: true
              }
            }
          }
        },
        init: undefined,
        destroy: undefined
      })
    }

    const timeoutId = setTimeout(loadParticles, 100)

    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <div
      id="tsparticles"
      ref={containerRef}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  )
}

export default ParticlesBackground

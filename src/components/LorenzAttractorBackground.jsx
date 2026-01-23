import { useMemo, useState, useEffect, useCallback } from 'react';

/**
 * LorenzAttractorBackground - Atractor de Lorenz (Edward Lorenz's Chaotic Butterfly)
 *
 * Sistema de ecuaciones diferenciales:
 * dx/dt = σ(y - x)
 * dy/dt = x(ρ - z) - y
 * dz/dt = xy - βz
 *
 * Parámetros clásicos: σ=10, ρ=28, β=8/3
 */

const LorenzAttractorBackground = () => {
  // Generar puntos del atractor de Lorenz
  const lorenzPath = useMemo(() => {
    const points = [];
    const sigma = 10;
    const rho = 28;
    const beta = 8 / 3;
    const dt = 0.005;
    const steps = 10000;

    let x = 0.1;
    let y = 0;
    let z = 0;

    for (let i = 0; i < steps; i++) {
      const dx = sigma * (y - x) * dt;
      const dy = (x * (rho - z) - y) * dt;
      const dz = (x * y - beta * z) * dt;

      x += dx;
      y += dy;
      z += dz;

      points.push({ x, y, z });
    }

    const allX = points.map(p => p.x);
    const allY = points.map(p => p.z);

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    const padding = 20;
    const width = 400;
    const height = 300;

    const normalized = points.map(p => ({
      x: padding + ((p.x - minX) / (maxX - minX)) * (width - 2 * padding),
      y: padding + ((p.z - minY) / (maxY - minY)) * (height - 2 * padding)
    }));

    return normalized.map((p, i) =>
      (i === 0 ? 'M' : 'L') + `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    ).join(' ');
  }, []);

  // Generar posición random para mariposas secundarias
  const generateRandomButterfly = useCallback(() => ({
    id: Math.random(),
    x: `${15 + Math.random() * 70}%`,
    y: `${15 + Math.random() * 70}%`,
    scale: 0.3 + Math.random() * 0.4,
    rotation: Math.random() * 360,
    opacity: 0.15 + Math.random() * 0.2,
    duration: 8 + Math.random() * 6,
  }), []);

  // Estado para mariposas random
  const [randomButterflies, setRandomButterflies] = useState(() =>
    Array.from({ length: 4 }, generateRandomButterfly)
  );

  // Ciclo de vida de mariposas random
  useEffect(() => {
    const intervals = randomButterflies.map((_, index) => {
      const delay = index * 3000 + Math.random() * 2000;

      return setTimeout(() => {
        const interval = setInterval(() => {
          setRandomButterflies(prev => {
            const newArr = [...prev];
            newArr[index] = generateRandomButterfly();
            return newArr;
          });
        }, (8 + Math.random() * 6) * 1000);

        return () => clearInterval(interval);
      }, delay);
    });

    return () => intervals.forEach(t => clearTimeout(t));
  }, [generateRandomButterfly]);

  return (
    <div className="fixed inset-0 -z-10 bg-[#0A0A0A] overflow-hidden">
      {/* Mariposa central - invertida y permanente */}
      <svg
        className="absolute lorenz-container"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) scale(2) scaleY(-1)',
          opacity: 0.7,
        }}
        width="400"
        height="300"
        viewBox="0 0 400 300"
      >
        <path
          d={lorenzPath}
          fill="none"
          stroke="white"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lorenz-path-main"
        />
        <path
          d={lorenzPath}
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.15"
          filter="blur(3px)"
          className="lorenz-path-main"
        />
      </svg>

      {/* Mariposas random que aparecen y desaparecen */}
      {randomButterflies.map((b) => (
        <svg
          key={b.id}
          className="absolute lorenz-random"
          style={{
            left: b.x,
            top: b.y,
            transform: `translate(-50%, -50%) scale(${b.scale}) rotate(${b.rotation}deg)`,
            opacity: b.opacity,
            '--duration': `${b.duration}s`,
          }}
          width="400"
          height="300"
          viewBox="0 0 400 300"
        >
          <path
            d={lorenzPath}
            fill="none"
            stroke="white"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lorenz-path-random"
            style={{ animationDuration: `${b.duration}s` }}
          />
          <path
            d={lorenzPath}
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.1"
            filter="blur(2px)"
            className="lorenz-path-random"
            style={{ animationDuration: `${b.duration}s` }}
          />
        </svg>
      ))}

      {/* Partículas sutiles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              animation: `twinkle ${Math.random() * 4 + 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes draw-lorenz-main {
          0% {
            stroke-dashoffset: 50000;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          30% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          70% {
            opacity: 0;
          }
          85% {
            opacity: 0;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        @keyframes draw-lorenz-random {
          0% {
            stroke-dashoffset: 50000;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0;
          }
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 0.1;
          }
          50% {
            opacity: 0.4;
          }
        }

        .lorenz-path-main {
          stroke-dasharray: 50000;
          stroke-dashoffset: 50000;
          animation: draw-lorenz-main 12s ease-in-out infinite;
        }

        .lorenz-path-random {
          stroke-dasharray: 50000;
          stroke-dashoffset: 50000;
          animation: draw-lorenz-random var(--duration, 10s) linear infinite;
        }

        .lorenz-container {
          filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
        }

        .lorenz-random {
          filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.2));
          transition: opacity 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LorenzAttractorBackground;

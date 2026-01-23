import { useMemo } from 'react';

/**
 * BackgroundButterflies - Mariposas decorativas de fondo
 *
 * Genera mariposas estilizadas usando curvas de Bézier
 * distribuidas alrededor del login con variaciones en:
 * - Tamaño (scale)
 * - Rotación
 * - Opacidad
 * - Posición
 */

/**
 * Genera el path SVG de una mariposa usando curvas de Bézier
 * Diseño simétrico con dos alas superiores e inferiores
 */
const generateButterflyPath = () => {
  // Ala superior derecha
  const upperRight = 'M 0 0 C 15 -20, 40 -25, 50 -15 C 55 -10, 50 -5, 40 0';
  // Ala inferior derecha
  const lowerRight = 'M 0 0 C 10 15, 30 30, 45 20 C 50 15, 45 5, 35 0';
  // Ala superior izquierda (espejada)
  const upperLeft = 'M 0 0 C -15 -20, -40 -25, -50 -15 C -55 -10, -50 -5, -40 0';
  // Ala inferior izquierda (espejada)
  const lowerLeft = 'M 0 0 C -10 15, -30 30, -45 20 C -50 15, -45 5, -35 0';
  // Cuerpo
  const body = 'M 0 -8 L 0 15';
  // Antenas
  const antennaRight = 'M 0 -8 C 3 -12, 8 -18, 12 -22';
  const antennaLeft = 'M 0 -8 C -3 -12, -8 -18, -12 -22';

  return {
    wings: `${upperRight} ${lowerRight} ${upperLeft} ${lowerLeft}`,
    body: `${body} ${antennaRight} ${antennaLeft}`
  };
};

/**
 * Genera posiciones distribuidas en los bordes/esquinas
 * evitando el centro donde está el login
 */
const generatePositions = (count, avoidCenter = true) => {
  const positions = [];
  const centerX = 50; // Porcentaje
  const centerY = 50;
  const safeRadius = 35; // Radio seguro alrededor del centro

  // Posiciones predefinidas en los bordes
  const edgePositions = [
    { x: 5, y: 10 },    // Esquina superior izquierda
    { x: 15, y: 5 },
    { x: 85, y: 8 },    // Esquina superior derecha
    { x: 92, y: 15 },
    { x: 8, y: 85 },    // Esquina inferior izquierda
    { x: 18, y: 92 },
    { x: 88, y: 88 },   // Esquina inferior derecha
    { x: 95, y: 75 },
    { x: 3, y: 45 },    // Lado izquierdo
    { x: 97, y: 55 },   // Lado derecho
    { x: 25, y: 3 },    // Lado superior
    { x: 75, y: 95 },   // Lado inferior
  ];

  for (let i = 0; i < Math.min(count, edgePositions.length); i++) {
    const pos = edgePositions[i];

    // Verificar que no esté en el centro
    if (avoidCenter) {
      const distFromCenter = Math.hypot(pos.x - centerX, pos.y - centerY);
      if (distFromCenter < safeRadius) continue;
    }

    // Añadir variación aleatoria pequeña
    positions.push({
      x: pos.x + (Math.random() - 0.5) * 5,
      y: pos.y + (Math.random() - 0.5) * 5
    });
  }

  return positions;
};

/**
 * Genera configuración para cada mariposa
 */
const generateButterflies = (count) => {
  const positions = generatePositions(count);

  return positions.map((pos, index) => ({
    id: index,
    x: pos.x,
    y: pos.y,
    scale: 0.3 + Math.random() * 0.9, // 0.3 - 1.2
    rotation: Math.random() * 360,
    opacity: 0.1 + Math.random() * 0.3, // 0.1 - 0.4
    animationDelay: Math.random() * 5, // Delay para animación
    animationDuration: 4 + Math.random() * 4 // 4-8 segundos
  }));
};

const BackgroundButterflies = ({
  count = 10,
  strokeColor = '#ffffff',
  strokeWidth = 0.5,
  animated = true,
  className = ''
}) => {
  // Generar mariposas (memoizado)
  const butterflies = useMemo(() => generateButterflies(count), [count]);
  const butterflyPaths = useMemo(() => generateButterflyPath(), []);

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Filtro de blur sutil */}
          <filter id="butterfly-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.1" />
          </filter>

          {/* Keyframes para animación de floating */}
          <style>
            {`
              @keyframes butterfly-float {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                25% { transform: translateY(-0.5%) rotate(2deg); }
                50% { transform: translateY(-1%) rotate(0deg); }
                75% { transform: translateY(-0.5%) rotate(-2deg); }
              }

              @keyframes butterfly-breathe {
                0%, 100% { opacity: var(--base-opacity); }
                50% { opacity: calc(var(--base-opacity) * 1.3); }
              }
            `}
          </style>
        </defs>

        {butterflies.map((butterfly) => (
          <g
            key={butterfly.id}
            transform={`translate(${butterfly.x}, ${butterfly.y}) scale(${butterfly.scale * 0.15}) rotate(${butterfly.rotation})`}
            opacity={butterfly.opacity}
            filter="url(#butterfly-blur)"
            style={animated ? {
              '--base-opacity': butterfly.opacity,
              animation: `butterfly-float ${butterfly.animationDuration}s ease-in-out infinite, butterfly-breathe ${butterfly.animationDuration * 0.8}s ease-in-out infinite`,
              animationDelay: `${butterfly.animationDelay}s`
            } : {}}
          >
            {/* Alas */}
            <path
              d={butterflyPaths.wings}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Cuerpo y antenas */}
            <path
              d={butterflyPaths.body}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth * 0.8}
              strokeLinecap="round"
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

export default BackgroundButterflies;

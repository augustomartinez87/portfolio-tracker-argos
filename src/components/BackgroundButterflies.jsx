import { useMemo } from 'react';

/**
 * BackgroundButterflies - Mariposas decorativas estilo wireframe/paramétrico
 *
 * Anatomía de cada mariposa:
 * - Alas superiores: 6 líneas concéntricas, forma ovalada/almendrada
 * - Alas inferiores: 5 líneas concéntricas, más pequeñas y redondeadas
 * - Cuerpo central: línea vertical con punto brillante
 * - Antenas: curvas delicadas con puntos en las puntas
 */

/**
 * Genera líneas concéntricas para un ala
 * Cada línea es progresivamente más pequeña creando efecto de profundidad
 */
const generateWingLines = (baseWidth, baseHeight, numLines) => {
  const lines = [];
  for (let i = 0; i < numLines; i++) {
    const scale = 1 - (i * 0.12); // Cada línea es 12% más pequeña
    const w = baseWidth * scale;
    const h = baseHeight * scale;
    // Curva bezier para forma de ala elegante
    lines.push({
      d: `M 0,0 Q ${w},${-h * 0.3} ${w * 0.8},${-h} Q ${w * 0.3},${-h * 0.7} 0,0`,
      opacity: 1 - i * 0.12
    });
  }
  return lines;
};

/**
 * Componente de mariposa paramétrica individual
 */
const ParametricButterfly = ({
  size = 100,
  opacity = 0.3,
  rotation = 0,
  animated = true,
  animationDelay = 0
}) => {
  // Pre-generar líneas de alas (memoizado)
  const upperWingLines = useMemo(() => generateWingLines(45, 55, 6), []);
  const lowerWingLines = useMemo(() => generateWingLines(35, 40, 5), []);

  return (
    <svg
      viewBox="-60 -50 120 120"
      style={{
        width: size,
        height: size * 1.2,
        filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.1))'
      }}
      className={animated ? 'butterfly-animated' : ''}
    >
      <g
        transform={`rotate(${rotation})`}
        opacity={opacity}
        style={animated ? {
          animation: `breathe 4s ease-in-out infinite`,
          animationDelay: `${animationDelay}s`
        } : {}}
      >
        {/* ============================================================
            ALA SUPERIOR IZQUIERDA - 6 líneas concéntricas
            ============================================================ */}
        <g transform="rotate(-50)">
          {upperWingLines.map((line, i) => (
            <path
              key={`ul-${i}`}
              d={line.d}
              fill="none"
              stroke="white"
              strokeWidth={0.5}
              opacity={line.opacity}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* ============================================================
            ALA SUPERIOR DERECHA - Espejada
            ============================================================ */}
        <g transform="rotate(50) scale(-1, 1)">
          {upperWingLines.map((line, i) => (
            <path
              key={`ur-${i}`}
              d={line.d}
              fill="none"
              stroke="white"
              strokeWidth={0.5}
              opacity={line.opacity}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* ============================================================
            ALA INFERIOR IZQUIERDA - 5 líneas, más pequeña
            ============================================================ */}
        <g transform="rotate(30) translate(0, 8)">
          {lowerWingLines.map((line, i) => (
            <path
              key={`ll-${i}`}
              d={line.d}
              fill="none"
              stroke="white"
              strokeWidth={0.4}
              opacity={line.opacity * 0.8}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* ============================================================
            ALA INFERIOR DERECHA - Espejada
            ============================================================ */}
        <g transform="rotate(-30) scale(-1, 1) translate(0, 8)">
          {lowerWingLines.map((line, i) => (
            <path
              key={`lr-${i}`}
              d={line.d}
              fill="none"
              stroke="white"
              strokeWidth={0.4}
              opacity={line.opacity * 0.8}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* ============================================================
            CUERPO CENTRAL - Elipse vertical delgada
            ============================================================ */}
        <ellipse
          cx="0"
          cy="8"
          rx="1.5"
          ry="18"
          fill="none"
          stroke="white"
          strokeWidth={0.4}
          opacity={0.5}
        />

        {/* ============================================================
            PUNTO CENTRAL BRILLANTE - Donde se unen las alas
            ============================================================ */}
        <circle cx="0" cy="0" r="2" fill="white" opacity={0.8}>
          {animated && (
            <animate
              attributeName="opacity"
              values="0.8;0.4;0.8"
              dur="3s"
              repeatCount="indefinite"
            />
          )}
        </circle>

        {/* Resplandor sutil del punto central */}
        <circle cx="0" cy="0" r="4" fill="white" opacity={0.15}>
          {animated && (
            <animate
              attributeName="opacity"
              values="0.15;0.05;0.15"
              dur="3s"
              repeatCount="indefinite"
            />
          )}
        </circle>

        {/* ============================================================
            ANTENAS - Curvas delicadas con puntos en las puntas
            ============================================================ */}
        {/* Antena izquierda */}
        <path
          d="M -1,-12 Q -10,-30 -6,-38"
          fill="none"
          stroke="white"
          strokeWidth={0.3}
          opacity={0.5}
          strokeLinecap="round"
        />
        <circle cx="-6" cy="-38" r="1" fill="white" opacity={0.4} />

        {/* Antena derecha */}
        <path
          d="M 1,-12 Q 10,-30 6,-38"
          fill="none"
          stroke="white"
          strokeWidth={0.3}
          opacity={0.5}
          strokeLinecap="round"
        />
        <circle cx="6" cy="-38" r="1" fill="white" opacity={0.4} />
      </g>
    </svg>
  );
};

/**
 * Configuración de mariposas para el fondo
 * Posiciones en porcentaje, distribuidas evitando el centro
 */
const BUTTERFLY_CONFIG = [
  { x: 5, y: 8, size: 80, rotation: -15, opacity: 0.2 },
  { x: 88, y: 5, size: 60, rotation: 20, opacity: 0.15 },
  { x: 3, y: 45, size: 100, rotation: -30, opacity: 0.25 },
  { x: 92, y: 50, size: 90, rotation: 45, opacity: 0.2 },
  { x: 8, y: 85, size: 70, rotation: 10, opacity: 0.28 },
  { x: 85, y: 88, size: 85, rotation: -25, opacity: 0.18 },
  { x: 2, y: 70, size: 50, rotation: 60, opacity: 0.12 },
  { x: 95, y: 25, size: 55, rotation: -40, opacity: 0.15 },
  { x: 15, y: 3, size: 45, rotation: 35, opacity: 0.1 },
  { x: 75, y: 92, size: 65, rotation: -10, opacity: 0.2 },
];

const BackgroundButterflies = ({
  count = 10,
  animated = true,
  className = ''
}) => {
  // Usar solo las primeras 'count' mariposas de la configuración
  const butterflies = useMemo(() =>
    BUTTERFLY_CONFIG.slice(0, Math.min(count, BUTTERFLY_CONFIG.length)),
    [count]
  );

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      {/* Estilos de animación */}
      <style>
        {`
          @keyframes breathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
          }

          .butterfly-animated {
            transition: opacity 0.3s ease;
          }
        `}
      </style>

      {/* Renderizar mariposas */}
      {butterflies.map((config, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${config.x}%`,
            top: `${config.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <ParametricButterfly
            size={config.size}
            rotation={config.rotation}
            opacity={config.opacity}
            animated={animated}
            animationDelay={index * 0.5}
          />
        </div>
      ))}
    </div>
  );
};

export default BackgroundButterflies;

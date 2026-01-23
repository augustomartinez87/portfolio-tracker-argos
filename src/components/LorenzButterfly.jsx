import { useMemo } from 'react';

/**
 * LorenzButterfly - Componente SVG del Atractor de Lorenz
 *
 * Genera matemáticamente la "mariposa" usando las ecuaciones diferenciales:
 * dx/dt = σ(y - x)
 * dy/dt = x(ρ - z) - y
 * dz/dt = xy - βz
 *
 * Parámetros clásicos de Edward Lorenz (1963): σ=10, ρ=28, β=8/3
 */

// Parámetros del sistema de Lorenz
const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;

/**
 * Genera los puntos de la trayectoria del atractor de Lorenz
 * usando integración de Euler
 */
const generateLorenzPoints = (numPoints = 10000, dt = 0.01) => {
  const points = [];
  let x = 0.1;
  let y = 0;
  let z = 0;

  for (let i = 0; i < numPoints; i++) {
    const dx = SIGMA * (y - x) * dt;
    const dy = (x * (RHO - z) - y) * dt;
    const dz = (x * y - BETA * z) * dt;

    x += dx;
    y += dy;
    z += dz;

    // Proyección 2D: usamos x y z para la vista de "mariposa"
    points.push({ x, z });
  }

  return points;
};

/**
 * Normaliza los puntos al rango del SVG viewBox
 */
const normalizePoints = (points, width, height, padding = 20) => {
  const xValues = points.map(p => p.x);
  const zValues = points.map(p => p.z);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);

  const rangeX = maxX - minX;
  const rangeZ = maxZ - minZ;

  return points.map(p => ({
    x: padding + ((p.x - minX) / rangeX) * (width - 2 * padding),
    y: padding + ((p.z - minZ) / rangeZ) * (height - 2 * padding)
  }));
};

/**
 * Convierte puntos a path SVG con comandos L (líneas)
 */
const pointsToPath = (points) => {
  if (points.length === 0) return '';

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }

  return path;
};

/**
 * Divide los puntos en segmentos para crear efecto de profundidad
 * con diferentes opacidades
 */
const createGradientSegments = (points, numSegments = 5) => {
  const segmentSize = Math.floor(points.length / numSegments);
  const segments = [];

  for (let i = 0; i < numSegments; i++) {
    const start = i * segmentSize;
    const end = i === numSegments - 1 ? points.length : (i + 1) * segmentSize;
    const segmentPoints = points.slice(start, end);

    // Opacidad gradual: más opaco en el medio de la trayectoria
    const progress = i / (numSegments - 1);
    const opacity = 0.3 + Math.sin(progress * Math.PI) * 0.5;

    segments.push({
      path: pointsToPath(segmentPoints),
      opacity
    });
  }

  return segments;
};

const LorenzButterfly = ({
  width = 600,
  height = 400,
  numPoints = 12000,
  dt = 0.005,
  strokeColor = '#ffffff',
  strokeWidth = 0.8,
  className = ''
}) => {
  // Generar y normalizar puntos (memoizado para performance)
  const { segments } = useMemo(() => {
    const rawPoints = generateLorenzPoints(numPoints, dt);
    const normalizedPoints = normalizePoints(rawPoints, width, height);
    const segments = createGradientSegments(normalizedPoints, 8);

    return { segments };
  }, [numPoints, dt, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Filtro de glow sutil */}
        <filter id="lorenz-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Renderizar segmentos con diferentes opacidades */}
      <g filter="url(#lorenz-glow)">
        {segments.map((segment, index) => (
          <path
            key={index}
            d={segment.path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={segment.opacity}
          />
        ))}
      </g>
    </svg>
  );
};

export default LorenzButterfly;

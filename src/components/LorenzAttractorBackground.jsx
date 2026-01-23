import { useEffect, useRef } from 'react';

/**
 * LorenzAttractorBackground - Atractor de Lorenz con Canvas
 *
 * ============================================================
 * PARÁMETROS AJUSTABLES
 * ============================================================
 */

// Parámetros del sistema de Lorenz (clásicos de Edward Lorenz)
const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;

// === MARIPOSA CENTRAL (estática, visible desde el inicio) ===
const CENTRAL_DT = 0.005;           // Paso de integración
const CENTRAL_STEPS = 12000;        // Puntos de la trayectoria
const CENTRAL_SCALE = 12;           // Escala de proyección
const CENTRAL_LINE_WIDTH = 2.5;     // Grosor de línea
const CENTRAL_COLOR = '#ffffff';    // Color blanco puro
const CENTRAL_OFFSET_Y_RATIO = 0.28; // Posición vertical (0.28 = 28% desde arriba)

// === MARIPOSAS PEQUEÑAS (animadas, posiciones random) ===
const SMALL_COUNT_DESKTOP = 12;     // Cantidad en desktop
const SMALL_COUNT_MOBILE = 6;       // Cantidad en mobile
const SMALL_SCALE_MIN = 0.30;       // Escala mínima (30% de central)
const SMALL_SCALE_MAX = 0.45;       // Escala máxima (45% de central)
const SMALL_DT = 0.008;             // dt más grande = dibujo más rápido
const SMALL_LINE_WIDTH = 1.2;       // Grosor de línea
const SMALL_OPACITY_MIN = 0.3;      // Opacidad mínima
const SMALL_OPACITY_MAX = 0.6;      // Opacidad máxima
const SMALL_POINTS_PER_FRAME = 8;   // Puntos dibujados por frame

// === DISTANCIAS MÍNIMAS (evitar superposición) ===
const MIN_DIST_FROM_CENTER = 500;   // Distancia mínima de la central (px)
const MIN_DIST_BETWEEN_SMALL = 300; // Distancia mínima entre chiquitas (px)
const MAX_PLACEMENT_ATTEMPTS = 100; // Intentos máximos para colocar

// === FADE DEL FONDO (trails elegantes) ===
const BACKGROUND_FADE = 'rgba(10, 10, 10, 0.04)';

/**
 * Genera los puntos de la trayectoria del atractor de Lorenz
 * usando integración de Euler
 */
const generateLorenzTrajectory = (steps, dt) => {
  const points = [];
  // Condiciones iniciales (cerca del atractor)
  let x = 0.1;
  let y = 0;
  let z = 0;

  for (let i = 0; i < steps; i++) {
    // Ecuaciones diferenciales de Lorenz
    const dx = SIGMA * (y - x) * dt;
    const dy = (x * (RHO - z) - y) * dt;
    const dz = (x * y - BETA * z) * dt;

    x += dx;
    y += dy;
    z += dz;

    points.push({ x, y, z });
  }

  return points;
};

/**
 * Proyecta punto 3D a 2D con perspectiva isométrica
 * screenX = x * scale
 * screenY = y * scale + z * zFactor (da profundidad)
 */
const projectTo2D = (point, scale, zFactor = 0.3) => {
  return {
    x: point.x * scale,
    y: point.y * scale + point.z * zFactor * scale * 0.5
  };
};

/**
 * Calcula distancia euclidiana entre dos puntos
 */
const distance = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

/**
 * Genera posición aleatoria evitando superposición
 */
const generateSafePosition = (
  width,
  height,
  centerPos,
  existingPositions,
  minDistFromCenter,
  minDistBetween
) => {
  const padding = 150;

  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const candidate = {
      x: padding + Math.random() * (width - 2 * padding),
      y: padding + Math.random() * (height - 2 * padding)
    };

    // Verificar distancia de la mariposa central
    if (distance(candidate, centerPos) < minDistFromCenter) {
      continue;
    }

    // Verificar distancia de otras mariposas pequeñas
    let tooClose = false;
    for (const pos of existingPositions) {
      if (distance(candidate, pos) < minDistBetween) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      return candidate;
    }
  }

  // Si no encuentra posición válida después de X intentos, retorna null
  return null;
};

const LorenzAttractorBackground = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Detectar si es mobile para ajustar cantidad
    const isMobile = width < 768;
    const smallCount = isMobile ? SMALL_COUNT_MOBILE : SMALL_COUNT_DESKTOP;

    // ============================================================
    // MARIPOSA CENTRAL - Estática, visible desde el inicio
    // ============================================================

    // Posición central (arriba del título)
    const centralPos = {
      x: width / 2,
      y: height * CENTRAL_OFFSET_Y_RATIO
    };

    // Generar trayectoria completa
    const centralTrajectory = generateLorenzTrajectory(CENTRAL_STEPS, CENTRAL_DT);

    // Proyectar todos los puntos a 2D y centrar
    const centralPoints2D = centralTrajectory.map(p => {
      const projected = projectTo2D(p, CENTRAL_SCALE);
      return {
        x: centralPos.x + projected.x,
        y: centralPos.y + projected.y
      };
    });

    // ============================================================
    // MARIPOSAS PEQUEÑAS - Posiciones aleatorias sin superposición
    // ============================================================

    const smallButterflies = [];
    const usedPositions = [];

    for (let i = 0; i < smallCount; i++) {
      // Intentar encontrar posición válida
      const pos = generateSafePosition(
        width,
        height,
        centralPos,
        usedPositions,
        MIN_DIST_FROM_CENTER,
        MIN_DIST_BETWEEN_SMALL
      );

      // Si no encuentra posición, saltar esta mariposa
      if (!pos) continue;

      usedPositions.push(pos);

      // Escala aleatoria entre min y max
      const scale = CENTRAL_SCALE * (SMALL_SCALE_MIN + Math.random() * (SMALL_SCALE_MAX - SMALL_SCALE_MIN));

      // Opacidad aleatoria
      const opacity = SMALL_OPACITY_MIN + Math.random() * (SMALL_OPACITY_MAX - SMALL_OPACITY_MIN);

      // Generar trayectoria independiente
      const trajectory = generateLorenzTrajectory(CENTRAL_STEPS, SMALL_DT);

      // Proyectar puntos
      const points2D = trajectory.map(p => {
        const projected = projectTo2D(p, scale);
        return {
          x: pos.x + projected.x,
          y: pos.y + projected.y
        };
      });

      smallButterflies.push({
        points: points2D,
        opacity,
        drawIndex: 0,
        // Offset de inicio aleatorio para que no empiecen todas juntas
        startDelay: Math.random() * 3000
      });
    }

    // ============================================================
    // FUNCIÓN DE DIBUJO - Mariposa central (una sola vez)
    // ============================================================

    const drawCentralButterfly = () => {
      ctx.beginPath();
      ctx.moveTo(centralPoints2D[0].x, centralPoints2D[0].y);

      for (let i = 1; i < centralPoints2D.length; i++) {
        ctx.lineTo(centralPoints2D[i].x, centralPoints2D[i].y);
      }

      ctx.strokeStyle = CENTRAL_COLOR;
      ctx.lineWidth = CENTRAL_LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    // ============================================================
    // LOOP DE ANIMACIÓN
    // ============================================================

    let startTime = performance.now();
    let centralDrawn = false;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;

      // Aplicar fade suave al fondo (crea trails elegantes)
      ctx.fillStyle = BACKGROUND_FADE;
      ctx.fillRect(0, 0, width, height);

      // Dibujar mariposa central (solo necesita dibujarse una vez
      // pero la redibujamos para mantenerla visible con el fade)
      if (!centralDrawn || elapsed % 500 < 20) {
        drawCentralButterfly();
        centralDrawn = true;
      }

      // ============================================================
      // ANIMAR MARIPOSAS PEQUEÑAS
      // ============================================================

      smallButterflies.forEach((butterfly) => {
        // Esperar delay inicial
        if (elapsed < butterfly.startDelay) return;

        const { points, opacity, drawIndex } = butterfly;

        // Calcular nuevo índice
        const newIndex = Math.min(drawIndex + SMALL_POINTS_PER_FRAME, points.length);

        if (drawIndex < points.length) {
          // Dibujar segmento actual
          ctx.beginPath();
          ctx.moveTo(points[drawIndex].x, points[drawIndex].y);

          for (let i = drawIndex + 1; i < newIndex; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }

          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.lineWidth = SMALL_LINE_WIDTH;
          ctx.lineCap = 'round';
          ctx.stroke();

          butterfly.drawIndex = newIndex;
        }

        // Si terminó de dibujar, reiniciar después de una pausa
        if (butterfly.drawIndex >= points.length) {
          // Reiniciar con nuevo delay aleatorio
          butterfly.drawIndex = 0;
          butterfly.startDelay = elapsed + 5000 + Math.random() * 10000;
        }
      });

      // Redibujar la central periódicamente para que no se desvanezca
      if (elapsed % 100 < 20) {
        drawCentralButterfly();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Limpiar canvas inicial (negro absoluto)
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Dibujar mariposa central inmediatamente
    drawCentralButterfly();

    // Iniciar animación
    animationRef.current = requestAnimationFrame(animate);

    // ============================================================
    // MANEJO DE RESIZE
    // ============================================================

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;

      // Limpiar y redibujar central
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
      drawCentralButterfly();
    };

    window.addEventListener('resize', handleResize);

    // ============================================================
    // CLEANUP
    // ============================================================

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        background: '#0a0a0a',
        zIndex: 0
      }}
    />
  );
};

export default LorenzAttractorBackground;

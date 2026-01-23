import { useEffect, useRef, useCallback } from 'react';

/**
 * LorenzAttractorBackground - Atractor de Lorenz con Canvas
 *
 * Sistema de ecuaciones diferenciales:
 * dx/dt = σ(y - x)
 * dy/dt = x(ρ - z) - y
 * dz/dt = xy - βz
 *
 * Parámetros clásicos: σ=10, ρ=28, β=8/3
 *
 * === TIMING (líneas 28-29) ===
 * - DRAW_DURATION = 20000ms (20 segundos de dibujo)
 * - PAUSE_DURATION = 20000ms (20 segundos de pausa)
 *
 * === COLORES (líneas 248-249 para central, 291-292 para chiquitas) ===
 * - Central: alterna entre #ffffff (blanco) y #000000 (negro)
 * - Chiquitas: alterna entre #ffffff, #000000 y #888888 (gris)
 *
 * === COLISIONES (líneas 140-142) ===
 * - Distancia mínima de central: 400px
 * - Distancia mínima entre chiquitas: 250px
 */

const LorenzAttractorBackground = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Parámetros del Atractor de Lorenz
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const dt = 0.005;

  // =====================================================
  // TIMING: 20 segundos de dibujo + 20 segundos de pausa
  // =====================================================
  const DRAW_DURATION = 20000; // 20 segundos en ms
  const PAUSE_DURATION = 20000; // 20 segundos en ms

  // =====================================================
  // COLISIONES: Distancias mínimas
  // =====================================================
  const MIN_DISTANCE_FROM_CENTER = 400; // px desde la central
  const MIN_DISTANCE_BETWEEN_SMALL = 250; // px entre chiquitas

  // Generar puntos del atractor de Lorenz
  const generateLorenzPoints = useCallback((steps = 15000) => {
    const points = [];
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

    return points;
  }, []);

  // Normalizar puntos al canvas con posición y escala específicas
  const normalizePointsWithTransform = useCallback((points, centerX, centerY, scale, width, height) => {
    const allX = points.map(p => p.x);
    const allY = points.map(p => p.z);

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    // Tamaño base de la mariposa
    const baseSize = Math.min(width, height) * 0.8 * scale;

    return points.map(p => ({
      x: centerX + ((p.x - minX) / rangeX - 0.5) * baseSize,
      y: centerY + ((p.z - minY) / rangeY - 0.5) * baseSize
    }));
  }, []);

  // Calcular distancia entre dos puntos
  const distance = (p1, p2) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // =====================================================
  // EVITAR SUPERPOSICIÓN: Generar posición random
  // =====================================================
  const generateRandomPosition = useCallback((width, height, existingPositions, minDistanceBetween, centerPosition, minDistanceFromCenter) => {
    const padding = 150;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const x = padding + Math.random() * (width - 2 * padding);
      const y = padding + Math.random() * (height - 2 * padding);
      const candidate = { x, y };

      let valid = true;

      // Chequear distancia con la mariposa central (distancia estricta)
      if (centerPosition) {
        const distToCenter = distance(candidate, centerPosition);
        if (distToCenter < minDistanceFromCenter) {
          valid = false;
        }
      }

      // Chequear distancia con otras mariposas chiquitas
      if (valid) {
        for (const pos of existingPositions) {
          const dist = distance(candidate, pos);
          if (dist < minDistanceBetween) {
            valid = false;
            break;
          }
        }
      }

      if (valid) {
        return candidate;
      }

      attempts++;
    }

    // Si no encuentra posición válida, posición en esquina
    return {
      x: padding + Math.random() * 100,
      y: padding + Math.random() * 100
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Generar puntos del atractor de Lorenz (15000 puntos)
    const allPoints = generateLorenzPoints(15000);

    // Centro de la mariposa principal (centro de pantalla)
    const centerX = width / 2;
    const centerY = height / 2;
    const centralPosition = { x: centerX, y: centerY };

    // Puntos para mariposa central (escala 1.0 = tamaño completo)
    const centralPoints = normalizePointsWithTransform(allPoints, centerX, centerY, 1.0, width, height);

    // =====================================================
    // MARIPOSAS CHICAS: Generar posiciones sin superposición
    // =====================================================
    const numSmallButterflies = 6;
    const smallButterflyPositions = [];

    for (let i = 0; i < numSmallButterflies; i++) {
      const pos = generateRandomPosition(
        width,
        height,
        smallButterflyPositions,
        MIN_DISTANCE_BETWEEN_SMALL,  // 250px entre chiquitas
        centralPosition,
        MIN_DISTANCE_FROM_CENTER     // 400px de la central
      );
      smallButterflyPositions.push(pos);
    }

    // Crear datos para cada mariposa chiquita
    const smallButterfliesData = smallButterflyPositions.map((pos, idx) => {
      // Escala random entre 0.15 y 0.25 (pequeñas)
      const scale = 0.15 + Math.random() * 0.1;
      const points = normalizePointsWithTransform(allPoints, pos.x, pos.y, scale, width, height);

      return {
        points,
        position: pos
      };
    });

    // =====================================================
    // ESTADO MARIPOSA CENTRAL
    // =====================================================
    const centralState = {
      drawIndex: 0,
      phase: 'drawing', // 'drawing' | 'pause' | 'reset'
      color: '#ffffff', // Empieza blanco, alterna a negro
      pauseStartTime: 0,
      drawStartTime: performance.now()
    };

    // Calcular puntos por frame para que dure exactamente 20 segundos
    // Asumiendo ~60fps = ~1200 frames en 20 segundos
    const framesIn20Seconds = (DRAW_DURATION / 1000) * 60;
    const pointsPerFrame = Math.ceil(centralPoints.length / framesIn20Seconds);

    // =====================================================
    // ESTADO MARIPOSAS CHIQUITAS (ciclo independiente)
    // =====================================================
    const smallButterflyStates = smallButterfliesData.map((_, idx) => ({
      drawIndex: 0,
      phase: 'drawing',
      color: '#ffffff',
      pauseStartTime: 0,
      drawStartTime: performance.now() + Math.random() * 8000, // Offset aleatorio 0-8s
      // Timing más corto para las chiquitas
      drawDuration: 10000 + Math.random() * 5000,  // 10-15 segundos de dibujo
      pauseDuration: 8000 + Math.random() * 7000   // 8-15 segundos de pausa
    }));

    // Calcular puntos por frame para cada chiquita
    const smallPointsPerFrame = smallButterfliesData.map((butterfly, idx) => {
      const state = smallButterflyStates[idx];
      const framesForDraw = (state.drawDuration / 1000) * 60;
      return Math.ceil(butterfly.points.length / framesForDraw);
    });

    // Manejo de redimensionamiento
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Función de renderizado principal
    const render = (currentTime) => {
      // Fade trail effect suave para trails elegantes
      ctx.fillStyle = 'rgba(10, 10, 10, 0.03)';
      ctx.fillRect(0, 0, width, height);

      // =====================================================
      // DIBUJAR MARIPOSA CENTRAL
      // =====================================================
      const cs = centralState;

      if (cs.phase === 'drawing') {
        // Dibujar puntos progresivamente
        const endIndex = Math.min(cs.drawIndex + pointsPerFrame, centralPoints.length);

        if (cs.drawIndex < endIndex) {
          ctx.beginPath();
          ctx.moveTo(centralPoints[cs.drawIndex].x, centralPoints[cs.drawIndex].y);

          for (let i = cs.drawIndex + 1; i < endIndex; i++) {
            ctx.lineTo(centralPoints[i].x, centralPoints[i].y);
          }

          ctx.strokeStyle = cs.color;
          ctx.lineWidth = 0.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          cs.drawIndex = endIndex;
        }

        // Verificar si terminó el dibujo (~20 segundos)
        if (cs.drawIndex >= centralPoints.length) {
          cs.phase = 'pause';
          cs.pauseStartTime = currentTime;
        }
      } else if (cs.phase === 'pause') {
        // =====================================================
        // PAUSA: Mantener visible 20 segundos
        // =====================================================
        if (currentTime - cs.pauseStartTime >= PAUSE_DURATION) {
          cs.phase = 'reset';
        }
      } else if (cs.phase === 'reset') {
        // =====================================================
        // RESET: Alternar color y reiniciar
        // =====================================================
        // Fade más fuerte para limpiar antes de redibujar
        ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // ALTERNAR COLOR: blanco <-> negro
        cs.color = cs.color === '#ffffff' ? '#000000' : '#ffffff';

        cs.drawIndex = 0;
        cs.phase = 'drawing';
        cs.drawStartTime = currentTime;
      }

      // =====================================================
      // DIBUJAR MARIPOSAS CHIQUITAS
      // =====================================================
      smallButterfliesData.forEach((butterfly, idx) => {
        const state = smallButterflyStates[idx];
        const points = butterfly.points;
        const ppf = smallPointsPerFrame[idx];

        // Esperar offset inicial
        if (currentTime < state.drawStartTime) {
          return;
        }

        if (state.phase === 'drawing') {
          const endIndex = Math.min(state.drawIndex + ppf, points.length);

          if (state.drawIndex < endIndex) {
            ctx.beginPath();
            ctx.moveTo(points[state.drawIndex].x, points[state.drawIndex].y);

            for (let i = state.drawIndex + 1; i < endIndex; i++) {
              ctx.lineTo(points[i].x, points[i].y);
            }

            ctx.strokeStyle = state.color;
            ctx.lineWidth = 0.4;
            ctx.lineCap = 'round';
            ctx.stroke();

            state.drawIndex = endIndex;
          }

          if (state.drawIndex >= points.length) {
            state.phase = 'pause';
            state.pauseStartTime = currentTime;
          }
        } else if (state.phase === 'pause') {
          if (currentTime - state.pauseStartTime >= state.pauseDuration) {
            state.phase = 'reset';
          }
        } else if (state.phase === 'reset') {
          // =====================================================
          // ALTERNAR COLOR CHIQUITAS: blanco -> negro -> gris
          // =====================================================
          if (state.color === '#ffffff') {
            state.color = '#000000';
          } else if (state.color === '#000000') {
            state.color = '#666666';
          } else {
            state.color = '#ffffff';
          }

          state.drawIndex = 0;
          state.phase = 'drawing';
          state.drawStartTime = currentTime;
        }
      });

      animationRef.current = requestAnimationFrame(render);
    };

    // Iniciar animación
    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [generateLorenzPoints, normalizePointsWithTransform, generateRandomPosition]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        background: 'transparent',
        zIndex: 0
      }}
    />
  );
};

export default LorenzAttractorBackground;

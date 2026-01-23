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
 * TIMING: 20 segundos dibujo + 20 segundos pausa
 * COLORES: Alterna blanco (#ffffff) y negro (#000000) cada ciclo
 * COLISIONES: Distancia mínima 400px de la central, 250px entre chiquitas
 */

const LorenzAttractorBackground = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Parámetros del Atractor de Lorenz
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const dt = 0.005;

  // Timing: 20 segundos de dibujo + 20 segundos de pausa
  const DRAW_DURATION = 20000; // 20 segundos en ms
  const PAUSE_DURATION = 20000; // 20 segundos en ms

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

  // Normalizar puntos al canvas
  const normalizePoints = useCallback((points, width, height, padding = 40) => {
    const allX = points.map(p => p.x);
    const allY = points.map(p => p.z);

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    return points.map(p => ({
      x: padding + ((p.x - minX) / (maxX - minX)) * (width - 2 * padding),
      y: padding + ((p.z - minY) / (maxY - minY)) * (height - 2 * padding)
    }));
  }, []);

  // Calcular distancia entre dos puntos
  const distance = (p1, p2) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // Generar posición random evitando colisiones
  const generateRandomPosition = useCallback((width, height, existingPositions, minDistance, centerPosition = null) => {
    const padding = 100;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const x = padding + Math.random() * (width - 2 * padding);
      const y = padding + Math.random() * (height - 2 * padding);
      const candidate = { x, y };

      let valid = true;

      // Chequear distancia con la mariposa central
      if (centerPosition) {
        const distToCenter = distance(candidate, centerPosition);
        if (distToCenter < minDistance) {
          valid = false;
        }
      }

      // Chequear distancia con otras mariposas
      if (valid) {
        for (const pos of existingPositions) {
          const dist = distance(candidate, pos);
          if (dist < minDistance) {
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

    // Si no encuentra posición válida, devolver posición por defecto
    return { x: width * 0.2, y: height * 0.2 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Generar puntos del atractor de Lorenz
    const allPoints = generateLorenzPoints(15000);

    // Centro de la mariposa principal
    const centerX = width / 2;
    const centerY = height / 2;
    const centralPosition = { x: centerX, y: centerY };

    // Mariposas pequeñas: generar posiciones evitando colisiones
    const numSmallButterflies = 6;
    const smallButterflyPositions = [];

    for (let i = 0; i < numSmallButterflies; i++) {
      // Mínimo 400px de la central, 250px entre cada una
      const pos = generateRandomPosition(width, height, smallButterflyPositions, 250, centralPosition);
      smallButterflyPositions.push(pos);
    }

    // Escalar puntos para mariposas pequeñas (40-60% del tamaño)
    const scaleSmall = 0.4 + Math.random() * 0.2;

    // Función para transformar puntos según posición y escala
    const transformPoints = (points, pos, scale, centerRef) => {
      return points.map(p => ({
        x: pos.x + (p.x - centerRef.x) * scale,
        y: pos.y + (p.y - centerRef.y) * scale
      }));
    };

    // Puntos para mariposa central
    const centralPoints = normalizePoints(allPoints, width, height, 40);

    // Puntos para mariposas pequeñas
    const smallButterfliesData = smallButterflyPositions.map((pos, idx) => {
      const points = transformPoints(allPoints, pos, scaleSmall, centralPosition);
      const normalizedPoints = normalizePoints(points, width, height, 20);
      return {
        points: normalizedPoints,
        colorPhase: 'white' // Alternará entre white/black
      };
    });

    // Estado de animación para mariposa central
    let centralState = {
      drawIndex: 0,
      phase: 'drawing', // 'drawing' | 'pause' | 'reset'
      color: '#ffffff',
      lastTime: performance.now(),
      pauseStartTime: 0
    };

    // Calcular puntos por frame para duración exacta de 20 segundos
    const totalPoints = centralPoints.length;
    const pointsPerFrame = Math.ceil(totalPoints / (DRAW_DURATION / 16.67)); // 60fps aproximado

    // Estado de animación para mariposas pequeñas
    const smallButterflyStates = smallButterflyData.map(() => ({
      drawIndex: 0,
      phase: 'drawing',
      color: '#ffffff',
      lastTime: performance.now() + Math.random() * 5000, // Offset aleatorio
      pauseStartTime: 0,
      pauseDuration: 5000 + Math.random() * 5000 // 5-10 segundos de pausa
    }));

    // Manejo de redimensionamiento
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Función de renderizado
    const render = (currentTime) => {
      // Fade trail effect suave (rgba(0,0,0,0.04))
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.fillRect(0, 0, width, height);

      // === MARIPOSA CENTRAL ===
      const cs = centralState;

      if (cs.phase === 'drawing') {
        // Dibujar desde drawIndex hasta drawIndex + pointsPerFrame
        const endIndex = Math.min(cs.drawIndex + pointsPerFrame, centralPoints.length);
        const prevIndex = cs.drawIndex;

        ctx.beginPath();
        let moved = false;

        for (let i = prevIndex; i < endIndex; i++) {
          if (i === 0) {
            ctx.moveTo(centralPoints[i].x, centralPoints[i].y);
            moved = true;
          } else {
            ctx.lineTo(centralPoints[i].x, centralPoints[i].y);
          }
        }

        ctx.strokeStyle = cs.color;
        ctx.lineWidth = 0.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        cs.drawIndex = endIndex;

        if (cs.drawIndex >= centralPoints.length) {
          cs.phase = 'pause';
          cs.pauseStartTime = currentTime;
        }
      } else if (cs.phase === 'pause') {
        // Mantener visible durante 20 segundos
        if (currentTime - cs.pauseStartTime >= PAUSE_DURATION) {
          cs.phase = 'reset';
        }
      } else if (cs.phase === 'reset') {
        // Limpiar canvas y reiniciar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, width, height);

        // Alternar color: blanco <-> negro
        cs.color = cs.color === '#ffffff' ? '#000000' : '#ffffff';

        cs.drawIndex = 0;
        cs.phase = 'drawing';
      }

      // === MARIPOSAS PEQUEÑAS ===
      smallButterflyData.forEach((butterfly, idx) => {
        const state = smallButterflyStates[idx];
        const points = butterfly.points;

        if (state.phase === 'drawing') {
          const pointsPerFrameSmall = Math.ceil(points.length / 10000); // Más rápido
          const endIndex = Math.min(state.drawIndex + pointsPerFrameSmall, points.length);
          const prevIndex = state.drawIndex;

          ctx.beginPath();

          for (let i = prevIndex; i < endIndex; i++) {
            if (i === 0) {
              ctx.moveTo(points[i].x, points[i].y);
            } else {
              ctx.lineTo(points[i].x, points[i].y);
            }
          }

          // Color: blanco o negro (con algo de gris para variedad)
          ctx.strokeStyle = state.color;
          ctx.lineWidth = 0.5;
          ctx.stroke();

          state.drawIndex = endIndex;

          if (state.drawIndex >= points.length) {
            state.phase = 'pause';
            state.pauseStartTime = currentTime;
          }
        } else if (state.phase === 'pause') {
          if (currentTime - state.pauseStartTime >= state.pauseDuration) {
            state.phase = 'reset';
          }
        } else if (state.phase === 'reset') {
          // Alternar color para variedad
          state.color = state.color === '#ffffff' ? '#000000' : '#888888';

          state.drawIndex = 0;
          state.phase = 'drawing';
        }
      });

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [generateLorenzPoints, normalizePoints, generateRandomPosition]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ background: '#1a1a1a' }}
    />
  );
};

export default LorenzAttractorBackground;

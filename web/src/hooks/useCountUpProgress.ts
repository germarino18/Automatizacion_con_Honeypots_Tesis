import { useEffect, useState } from 'react';

const DEFAULT_DURATION_MS = 1_200;
const FALLBACK_FRAME_MS = 16;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Progreso 0→1 animado con rAF (ease-out cúbico) para los count-ups del
 * hero card. Respeta `prefers-reduced-motion`: el estado nace en 1 y el
 * efecto no anima, de modo que los componentes renderizan los valores
 * finales reales sin transición. Sin rAF (SSR/tests sin DOM) degrada a un
 * timer de ~16ms.
 */
export function useCountUpProgress(
  durationMs: number = DEFAULT_DURATION_MS,
): number {
  const [progress, setProgress] = useState(() =>
    prefersReducedMotion() ? 1 : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const nextFrame: (callback: FrameRequestCallback) => number =
      typeof requestAnimationFrame === 'function'
        ? (callback) => requestAnimationFrame(callback)
        : (callback) =>
            window.setTimeout(() => callback(performance.now()), FALLBACK_FRAME_MS);
    const cancelFrame: (id: number) => void =
      typeof cancelAnimationFrame === 'function'
        ? (id) => cancelAnimationFrame(id)
        : (id) => window.clearTimeout(id);

    let frameId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - t) ** 3;
      setProgress(t < 1 ? eased : 1);
      if (t < 1) frameId = nextFrame(tick);
    };
    frameId = nextFrame(tick);
    return () => cancelFrame(frameId);
  }, [durationMs]);

  return progress;
}
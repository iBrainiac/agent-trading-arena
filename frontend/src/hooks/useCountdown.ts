import { useState, useEffect } from 'react';

export function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(Math.max(0, targetMs - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      const r = Math.max(0, targetMs - Date.now());
      setRemaining(r);
      if (r === 0) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [targetMs]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isCritical = totalSeconds <= 30;
  const isPulsing = totalSeconds <= 10;

  return { remaining, minutes, seconds, isCritical, isPulsing, totalSeconds };
}

import { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { OHLCV } from '../../types/arena';

interface Props {
  history: OHLCV[];
  targetPrice: number;
  currentPrice: number;
}

export function CandlestickChart({ history, targetPrice, currentPrice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;
    initialized.current = true;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#00ff41',
      },
      grid: {
        vertLines: { color: 'rgba(0,255,65,0.05)' },
        horzLines: { color: 'rgba(0,255,65,0.05)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(0,255,65,0.2)' },
      timeScale: {
        borderColor: 'rgba(0,255,65,0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff87',
      downColor: '#ff4757',
      borderUpColor: '#00ff87',
      borderDownColor: '#ff4757',
      wickUpColor: '#00ff87',
      wickDownColor: '#ff4757',
    });
    candleSeriesRef.current = candleSeries;

    // Target price line
    const targetLine = chart.addLineSeries({
      color: '#ffb700',
      lineWidth: 1,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    if (history.length > 0) {
      const candleData = history.map((c) => ({
        time: Math.floor(c.ts / 1000) as unknown as number,
        open: c.o, high: c.h, low: c.l, close: c.c,
      }));
      candleSeries.setData(candleData as never);

      const targetData = history.map((c) => ({
        time: Math.floor(c.ts / 1000) as unknown as number,
        value: targetPrice,
      }));
      targetLine.setData(targetData as never);

      chart.timeScale().fitContent();
    }

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      initialized.current = false;
    };
  }, []);

  // Update latest candle
  useEffect(() => {
    if (!candleSeriesRef.current || history.length === 0) return;
    const last = history[history.length - 1];
    candleSeriesRef.current.update({
      time: Math.floor(last.ts / 1000) as unknown as number,
      open: last.o, high: last.h, low: last.l, close: last.c,
    } as never);
  }, [currentPrice, history]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

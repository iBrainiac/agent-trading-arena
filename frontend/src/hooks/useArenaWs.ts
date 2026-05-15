import { useEffect, useRef } from 'react';
import { useArenaStore } from '../store/arenaStore';
import type { WsEvent } from '../types/arena';

const WS_URL = `ws://${window.location.hostname}:3001`;

export function useArenaWs() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const store = useArenaStore();

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        store.setWsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data) as WsEvent;
          switch (event.type) {
            case 'ARENA_SNAPSHOT':   store.setArena(event.data); break;
            case 'ARENA_RESET':      store.clearArena(); break;
            case 'PHASE_CHANGE':     store.setPhase(event.data.phase); break;
            case 'PRICE_UPDATE':
              store.updatePrice(event.data.price, event.data.candle, event.data.pnlA, event.data.pnlB);
              break;
            case 'SIGNAL_UPDATE':    store.addSignal(event.data.signal); break;
            case 'AGENT_TICK':       store.recordAgentTick(event.data.agentId, event.data.action); break;
            case 'PAYMENT_UPDATE':   store.updatePayment(event.data.agentId, event.data.payment); break;
            case 'PAYOUT_UPDATE':    store.updatePayout(event.data); break;
            case 'RESOLUTION':       store.setResolution(event.data.winner, event.data.finalPrice); break;
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        store.setWsConnected(false);
        if (!destroyed && reconnectAttempts.current < 20) {
          reconnectAttempts.current++;
          setTimeout(connect, Math.min(1000 * reconnectAttempts.current, 10_000));
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();
    const pingTimer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
    }, 25_000);

    return () => {
      destroyed = true;
      clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, []);
}

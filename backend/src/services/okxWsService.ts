import WebSocket from 'ws';
import { config } from '../config';
import { logger } from '../utils/logger';
import { okxWsAuthArgs } from '../utils/hmacSign';
import { updatePrice, addSignal } from './arenaService';
import { broadcast } from '../server/wsServer';
import type { OHLCV, SignalEvent } from '../models/ArenaState';

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECTS = 20;
const RECONNECT_DELAY_MS = 3000;
let heartbeatTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isSubscribed = false;

function clearTimers() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function subscribe() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const { symbol, chainIndex, tokenContractAddress } = config.targetAsset;

  ws.send(JSON.stringify({
    op: 'subscribe',
    args: [
      { channel: 'price', instId: `${symbol}-USDC` },
      { channel: 'dex-token-candle1m', chainIndex, tokenContractAddress },
      { channel: 'dex-market-new-signal-openapi', chainIndex, symbol },
    ],
  }));
  isSubscribed = true;
  logger.info('OKX WS subscribed to price, candle, signal channels');
}

function handleMessage(raw: string) {
  if (raw === 'pong') return;

  let msg: Record<string, unknown>;
  try { msg = JSON.parse(raw); } catch { return; }

  if (msg['event'] === 'login') {
    logger.info('OKX WS logged in');
    subscribe();
    return;
  }

  const channel = (msg['arg'] as Record<string, string>)?.channel;
  const data = msg['data'] as unknown[];
  if (!data?.length) return;

  if (channel === 'price') {
    const [priceStr] = data as string[];
    const price = parseFloat(priceStr);
    if (!isNaN(price)) {
      const candle: OHLCV = { ts: Date.now(), o: price, h: price, l: price, c: price, vol: 0, volUsd: 0, confirm: false };
      updatePrice(price, candle);
    }
    return;
  }

  if (channel === 'dex-token-candle1m') {
    const [ts, o, h, l, c, vol, volUsd, confirm] = data[0] as [number, string, string, string, string, string, string, string];
    const candle: OHLCV = {
      ts: Number(ts),
      o: parseFloat(o), h: parseFloat(h), l: parseFloat(l), c: parseFloat(c),
      vol: parseFloat(vol), volUsd: parseFloat(volUsd),
      confirm: confirm === '1',
    };
    updatePrice(candle.c, candle);
    return;
  }

  if (channel === 'dex-market-new-signal-openapi') {
    const raw = data[0] as Record<string, unknown>;
    const signal: SignalEvent = {
      ts: Number(raw['ts']),
      symbol: String(raw['symbol']),
      walletType: String(raw['walletType']) as '1' | '2' | '3',
      amountUsd: Number(raw['amountUsd']),
      triggerWalletCount: Number(raw['triggerWalletCount']),
      soldRatioPercentage: Number(raw['soldRatioPercentage']),
    };
    addSignal(signal);
    broadcast({ type: 'SIGNAL_UPDATE', data: { signal } });
  }
}

function connect() {
  if (ws) { ws.terminate(); ws = null; }
  clearTimers();

  ws = new WebSocket(config.okx.wsUrl);

  ws.on('open', () => {
    reconnectAttempts = 0;
    logger.info('OKX WS connected');
    const authArgs = okxWsAuthArgs(config.okx.apiKey, config.okx.secretKey, config.okx.passphrase);
    ws!.send(JSON.stringify(authArgs));
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send('ping');
    }, 25_000);
  });

  ws.on('message', (data) => handleMessage(data.toString()));

  ws.on('close', () => {
    clearTimers();
    isSubscribed = false;
    logger.warn(`OKX WS closed, reconnect attempt ${reconnectAttempts + 1}/${MAX_RECONNECTS}`);
    if (reconnectAttempts < MAX_RECONNECTS) {
      reconnectAttempts++;
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    } else {
      logger.error('OKX WS max reconnects reached');
    }
  });

  ws.on('error', (err) => logger.error('OKX WS error', err.message));
}

export function startOkxWs() {
  logger.info(`Starting OKX WS (${config.network})`);
  connect();
}

export function stopOkxWs() {
  clearTimers();
  ws?.terminate();
  ws = null;
}

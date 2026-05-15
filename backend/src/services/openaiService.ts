import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { ArenaState, AgentId, Position } from '../models/ArenaState';

const client = new OpenAI({ apiKey: config.openaiApiKey });

export interface AgentDecision {
  decision: Position;
  size: string;
  reasoning: string;
}

function buildSystemPrompt(agentId: AgentId, arena: ArenaState): string {
  const agent = arena[agentId];
  return `You are an autonomous trading agent competing in a prediction market arena.
Your goal is to maximize your P&L before market resolution.

Market question: ${arena.market.question}
Target price: $${arena.market.targetPrice} USD
Target asset: ${arena.market.targetAsset.symbol}
Resolution time: ${new Date(arena.market.resolutionTime).toISOString()} UTC
Your agent: ${agent.displayName}
Your current position: ${agent.position}
Your current stake: ${agent.stake} USDT
Your current P&L: ${agent.currentPnl} USD

Respond ONLY with a JSON object in this exact format — no markdown, no commentary:
{"decision":"LONG"|"SHORT"|"HOLD","size":"0.0 to 1.0","reasoning":"<one sentence max 120 chars>"}

Rules:
- size is the fraction of your stake to commit (0.0=nothing, 1.0=all-in).
- If decision is HOLD, size must be 0.0.
- Be decisive. HOLD at resolution means zero P&L.`;
}

function buildUserPrompt(agentId: AgentId, arena: ArenaState): string {
  const history = arena.market.priceHistory.slice(-20);
  const price1mAgo = history[history.length - 2]?.c ?? arena.market.currentPrice;
  const price5mAgo = history[Math.max(0, history.length - 6)]?.c ?? arena.market.currentPrice;
  const price10mAgo = history[Math.max(0, history.length - 11)]?.c ?? arena.market.currentPrice;

  const candleTable = history
    .slice(-5)
    .map((c) => `${new Date(c.ts).toISOString()} | o:${c.o} h:${c.h} l:${c.l} c:${c.c} vol:$${c.volUsd.toFixed(0)}`)
    .join('\n') || 'No candle data yet';

  const signalTable = arena.market.lastSignals
    .map((s) => {
      const type = s.walletType === '1' ? 'SmartMoney' : s.walletType === '2' ? 'KOL' : 'Whale';
      return `${new Date(s.ts).toISOString()} | ${type} | $${s.amountUsd.toFixed(0)} | ${s.triggerWalletCount} wallets | sold:${s.soldRatioPercentage}%`;
    })
    .join('\n') || 'No signals yet';

  const timeRemaining = Math.max(0, arena.market.resolutionTime - Date.now());
  const distanceFromTarget = arena.market.currentPrice - arena.market.targetPrice;
  const distancePct = ((distanceFromTarget / arena.market.targetPrice) * 100).toFixed(2);

  const opponentId: AgentId = agentId === 'agentA' ? 'agentB' : 'agentA';
  const opponent = arena[opponentId];

  return `CURRENT MARKET DATA (tick at ${new Date().toISOString()}):

Current price: $${arena.market.currentPrice}
Price 1m ago: $${price1mAgo} | 5m ago: $${price5mAgo} | 10m ago: $${price10mAgo}

Last 5 candles (1m OHLCV):
${candleTable}

Recent smart-money signals (last 5):
${signalTable}

Time remaining: ${Math.floor(timeRemaining / 1000)}s
Distance from target: $${distanceFromTarget.toFixed(2)} (${distancePct}%)
Opponent (${opponent.displayName}) last action: ${opponent.lastAction?.decision ?? 'NONE'} size ${opponent.lastAction?.size ?? '0'}

What is your next trading decision?`;
}

async function callWithRetry(
  systemPrompt: string,
  userPrompt: string,
  attempt = 1,
): Promise<AgentDecision> {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 200,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(text) as { decision?: string; size?: string; reasoning?: string };

    const decision = (['LONG', 'SHORT', 'HOLD'].includes(parsed.decision ?? '')
      ? parsed.decision
      : 'HOLD') as Position;
    const size = decision === 'HOLD' ? '0.0' : String(Math.min(1, Math.max(0, parseFloat(parsed.size ?? '0.5'))));
    const reasoning = (parsed.reasoning ?? 'No reasoning provided').slice(0, 120);

    return { decision, size, reasoning };
  } catch (err) {
    if (attempt < 3) {
      const delay = attempt * 1500;
      await new Promise((r) => setTimeout(r, delay));
      return callWithRetry(systemPrompt, userPrompt, attempt + 1);
    }
    logger.error('OpenAI failed after 3 attempts', err);
    return { decision: 'HOLD', size: '0.0', reasoning: 'Error: defaulting to HOLD' };
  }
}

export async function reasonForAgent(agentId: AgentId, arena: ArenaState): Promise<AgentDecision> {
  const systemPrompt = buildSystemPrompt(agentId, arena);
  const userPrompt = buildUserPrompt(agentId, arena);
  logger.info(`OpenAI reasoning for ${agentId}`);
  return callWithRetry(systemPrompt, userPrompt);
}

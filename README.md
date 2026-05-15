# Agent Trading Arena

Two AI agents enter. One walks out richer.

A real-time prediction market where OpenAI-powered agents compete against each other — paying entry fees via x402, trading live on-chain via OKX DEX, and settling the winner's payout via a2a-pay. Rendered as a glowing Circuit Board + War Room hybrid UI.

---

## How It Works

### The Arena Loop

```
1. You create a market  →  "Will ETH be above $3200 in 5 minutes?"
2. Agent A and Agent B pay entry fees via x402 (Sepolia USDC on testnet)
3. Both agents receive live price data + smart-money signals from OKX
4. Every 10 seconds, each agent asks GPT-4o: LONG, SHORT, or HOLD?
5. Decisions execute as real swaps via OKX DEX
6. At resolution time, the agent with higher P&L wins
7. The winner receives the full pool via a2a-pay settlement
```

### The UI

The interface is styled as a **PCB circuit board**. Each agent is rendered as an IC chip with live stats, reasoning logs, and a status LED. The center panel is the "Market Processor" chip — a live candlestick chart with the prediction target line overlaid. SVG traces connecting the chips animate with flowing current during trading. When a swap executes, a particle spark fires at the connection point. At resolution, the board flashes and the winning chip glows green while the losing chip dims.

---

## Architecture

```
agent-trading-arena/
├── backend/                    Node.js + Express + WebSocket
│   └── src/
│       ├── config.ts           Single env switch: testnet ↔ mainnet
│       ├── server/
│       │   ├── httpServer.ts   REST API (arena create, entry, market snapshot)
│       │   └── wsServer.ts     WebSocket broadcaster (real-time state to all clients)
│       └── services/
│           ├── arenaService.ts     Market lifecycle state machine
│           ├── agentLoopService.ts 10s tick: signals → GPT-4o → swap
│           ├── okxWsService.ts     OKX DEX WebSocket (price, candles, signals)
│           ├── openaiService.ts    GPT-4o prompt assembly + decision parsing
│           ├── okxSwapService.ts   onchainos swap execution with retry logic
│           └── paymentService.ts   x402 entry fees + a2a-pay payout
│
├── frontend/                   React + Vite
│   └── src/
│       ├── store/arenaStore.ts     Zustand store — all UI derives from here
│       ├── hooks/useArenaWs.ts     WebSocket client with auto-reconnect
│       ├── components/
│       │   ├── layout/             CircuitBoard (PCB bg) + TraceLayer (SVG traces)
│       │   ├── agent/              AgentChip, AgentStats, ReasoningLog
│       │   ├── market/             MarketProcessor, CandlestickChart, CountdownTimer
│       │   ├── payment/            PaymentTrace (amber glow on active payments)
│       │   └── fx/                 SparkCanvas, BoardFlash
│       └── styles/                 CSS variables, glow keyframes, trace animations
│
└── shared/
    └── types/arena.ts          Canonical TypeScript interfaces shared by both sides
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Styling | Pure CSS (no framework) — CSS variables, keyframe animations, SVG |
| Animations | Framer Motion (chip state changes), Canvas API (spark particles) |
| Charts | lightweight-charts (TradingView-style candlesticks) |
| State | Zustand |
| Backend | Node.js, Express, `ws` library |
| AI Agents | OpenAI GPT-4o (`response_format: json_object`) |
| Real-time data | OKX DEX WebSocket (`wss://wsdex.okx.com/ws/v6/dex`) |
| Trading | OKX DEX via `onchainos swap execute` |
| Payments | x402 exact scheme (entry fees) + a2a-pay (winner payout) |
| Network | Ethereum Sepolia testnet (default) / Ethereum mainnet (one env var) |

---

## Prerequisites

- Node.js 20+
- OKX API credentials (API key, secret, passphrase)
- OpenAI API key with GPT-4o access
- `onchainos` CLI installed and two agent wallets logged in
- Sepolia USDC in both agent wallets (for testnet entry fees)

---

## Installation

```bash
# Clone and install
git clone <repo-url>
cd agent-trading-arena
npm install
```

---

## Configuration

Copy the example env file and fill in your credentials:

```bash
cp .env.example backend/.env
```

```bash
# backend/.env

NETWORK=testnet                  # Switch to "mainnet" when ready — zero code changes needed

OKX_API_KEY=your_key
OKX_SECRET_KEY=your_secret
OKX_PASSPHRASE=your_passphrase

OPENAI_API_KEY=sk-...

AGENT_A_WALLET_ADDRESS=0x...     # Wallet for Agent ALPHA-7
AGENT_B_WALLET_ADDRESS=0x...     # Wallet for Agent OMEGA-3
ARENA_ESCROW_WALLET=0x...        # Receives the x402 entry fees

PORT=3001
FRONTEND_ORIGIN=http://localhost:5173

TARGET_ASSET_SYMBOL=ETH
TARGET_CHAIN_INDEX=1
TARGET_ASSET_CONTRACT=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
```

Login the agent wallets before starting (required for swap + payment execution):

```bash
onchainos wallet login --wallet $AGENT_A_WALLET_ADDRESS
onchainos wallet login --wallet $AGENT_B_WALLET_ADDRESS
```

---

## Running

Start both backend and frontend together:

```bash
npm run dev
```

Or start them separately:

```bash
# Terminal 1 — backend (port 3001)
npm run dev --workspace=backend

# Terminal 2 — frontend (port 5173)
npm run dev --workspace=frontend
```

Open `http://localhost:5173`.

---

## Using the Arena

1. **Fill in the form** — prediction question, target price, duration (minutes), entry fee (USDT)
2. **Click "Launch Arena"** — the market is created and agents enter the `ENTRY` phase
3. **Entry payments** — both agents pay the x402 entry fee; the amber traces glow as payments confirm
4. **Trading begins** — green traces animate, agents tick every 10s, sparks fire on each swap
5. **Countdown expires** — market resolves, board flashes, winner chip glows, loser dims
6. **Payout** — a2a-pay settles the full pool to the winner's wallet

---

## Switching to Mainnet

Change a single line in `backend/.env`:

```bash
NETWORK=mainnet
```

Everything else updates automatically:
- Chain switches from Sepolia (`eip155:11155111`) to Ethereum (`eip155:1`)
- USDC address switches from Sepolia to mainnet
- x402 payment scheme uses mainnet CAIP-2 identifier
- OKX WebSocket subscribes to mainnet price feeds

---

## Testing

### Backend type check

```bash
npx tsc --project backend/tsconfig.json --noEmit
```

### Frontend type check

```bash
cd frontend && npx tsc --noEmit
```

### Health check (backend running)

```bash
curl http://localhost:3001/health
# → {"ok":true}
```

### Create an arena via API

```bash
curl -X POST http://localhost:3001/api/arena/create \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Will ETH be above $3200 in 5 minutes?",
    "targetPrice": 3200,
    "targetAsset": {
      "symbol": "ETH",
      "chainIndex": "1",
      "tokenContractAddress": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    },
    "resolutionTimeIso": "2026-05-15T15:30:00.000Z",
    "entryFeeUsdt": "10"
  }'
```

### Simulate agent entry (bypass x402 for local testing)

```bash
# Trigger entry for agentA with a mock payment header
curl -X POST "http://localhost:3001/api/arena/<arenaId>/entry?agentId=agentA" \
  -H "payment-signature: mock_sig_for_testing"

# Trigger entry for agentB
curl -X POST "http://localhost:3001/api/arena/<arenaId>/entry?agentId=agentB" \
  -H "payment-signature: mock_sig_for_testing"
```

Once both agents confirm, the arena transitions to `TRADING` automatically and the agent loop starts.

### Watch live WebSocket events

```bash
# Requires wscat: npm install -g wscat
wscat -c ws://localhost:3001

# On connect you'll receive ARENA_SNAPSHOT
# Then PRICE_UPDATE, AGENT_TICK, PAYMENT_UPDATE events stream in live
```

---

## WebSocket Event Reference

| Event | Payload | When |
|---|---|---|
| `ARENA_SNAPSHOT` | Full `ArenaState` | On connect, and after reconnect |
| `PHASE_CHANGE` | `{ phase }` | Every lifecycle transition |
| `PRICE_UPDATE` | `{ price, candle }` | Every OKX price push |
| `SIGNAL_UPDATE` | `{ signal }` | New smart-money signal detected |
| `AGENT_TICK` | `{ agentId, action }` | Every 10s per agent |
| `PAYMENT_UPDATE` | `{ agentId, payment }` | Entry fee phase changes |
| `PAYOUT_UPDATE` | `PayoutPayment` | a2a-pay status polling |
| `RESOLUTION` | `{ winner, finalPrice }` | Market resolved |

---

## Key Files

| File | What to edit |
|---|---|
| `backend/src/config.ts` | Add new chains, adjust tick interval, tune buffer sizes |
| `backend/src/services/openaiService.ts` | Tune agent prompts, switch model, adjust temperature |
| `backend/src/services/agentLoopService.ts` | Change tick frequency, add more agents |
| `frontend/src/styles/globals.css` | PCB color palette — tweak the whole visual theme here |
| `frontend/src/components/layout/TraceLayer.tsx` | SVG trace paths — reroute connections |
| `shared/types/arena.ts` | Data model — changes here propagate to both sides |

---

## License

MIT

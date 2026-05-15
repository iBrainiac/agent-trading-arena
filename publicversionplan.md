# Agent Trading Arena — Public Version Plan

## Overview

The demo version proves the concept: two AI agents compete in a prediction market, pay entry fees via x402, trade live OKX DEX data, and settle via a2a-pay — fully autonomous, zero human approval. This document is the technical and product roadmap to turn that into a public platform.

The public product is best framed as: **AI Agent Colosseum** — a live arena where anyone deploys an AI trading agent, funds it from their own wallet, and competes against strangers, while a crowd bets on the outcome in real time.

---

## What Stays the Same

- OKX DEX WebSocket for live price, candles, smart-money signals
- OKX DEX Swap for on-chain execution
- x402 for entry fee payments
- a2a-pay for winner payout
- GPT-4o (or user-selected model) for agent reasoning
- Base mainnet (low gas, OKX DEX supported)
- React + Vite frontend, Node.js + Express + ws backend
- Circuit Board UI aesthetic — extend it, don't replace it

---

## Critical Architecture Changes

### 1. Smart Contract Escrow (most important change)

**Current:** Entry fees go to an EOA wallet you control. Anyone has to trust you not to rug.

**Public:** Audited smart contract holds funds. No one — including you — can touch the pool until the oracle resolves the market.

**Contract responsibilities:**
- Accept USDC deposits from both agents (EIP-3009 transferWithAuthorization)
- Lock funds until resolution
- Pay winner (or split on draw) based on signed resolution message from backend oracle
- Take platform fee (2%) before paying winner
- Emit events for all state changes (indexable by The Graph)

**Stack:** Solidity, Hardhat, OpenZeppelin. Deploy on Base. Verify on Basescan.

**Oracle security:** The backend signs the resolution with a private key. The contract verifies the signature. For v1 this is centralized (your key). V2 moves to a decentralized oracle (Chainlink, UMA, or multi-sig committee).

```solidity
// Rough interface
interface IArenaEscrow {
    function deposit(bytes32 arenaId, address agent, uint256 amount, bytes calldata sig) external;
    function resolve(bytes32 arenaId, address winner, bytes calldata oracleSig) external;
    function refund(bytes32 arenaId, bytes calldata oracleSig) external; // draw
    function collectFees() external; // owner only
}
```

---

### 2. User Wallet Connection

**Current:** Agent wallets are hardcoded env vars you control.

**Public:** Users connect their own wallet (MetaMask, Coinbase Wallet, Rabby, etc.) and their wallet IS the agent wallet.

**Stack:** [wagmi v2](https://wagmi.sh) + [RainbowKit](https://www.rainbowkit.com) for wallet connection. viem for on-chain reads/writes.

**Flow:**
1. User connects wallet on frontend
2. Signs a session message (EIP-712) — proves ownership without a backend account system
3. Backend creates an agent tied to their wallet address
4. Entry fee is pulled from their wallet via EIP-3009 (same x402 scheme, but user signs in browser)
5. All swap proceeds go back to their wallet

**Key difference from demo:** The `onchainos` CLI won't work for user wallets — users sign in their own browser wallet. x402 entry becomes a frontend `eth_signTypedData` call instead of a CLI call. The route still returns HTTP 402, but the frontend handles payment (not the backend).

---

### 3. Multi-Arena Support

**Current:** One arena globally, one state object in memory.

**Public:** Hundreds of concurrent arenas, each with its own lifecycle, agents, and pool.

**Backend changes:**
- Replace the global `arenaState` singleton in `arenaService.ts` with a `Map<arenaId, ArenaState>`
- Each arena has its own agent loop interval
- WebSocket rooms: clients subscribe to a specific `arenaId`, not a global broadcast
- Persist arena state to a database (PostgreSQL recommended — see below)
- Arena discovery API: `GET /api/arenas` — returns open arenas, live arenas, recently resolved

**Frontend changes:**
- Arena lobby/browser page (list of open arenas to join)
- Arena detail page (current Circuit Board view, per arena)
- My arenas page (arenas the user's agent is competing in)

---

### 4. Database

**Current:** All state is in-memory. Server restart = all data lost.

**Public:** Persistent storage for arenas, agents, transactions, leaderboard.

**Recommended stack:** PostgreSQL (via [Drizzle ORM](https://orm.drizzle.team) — lightweight, TypeScript-first)

**Core tables:**
```sql
arenas          -- id, question, target_price, resolution_time, phase, winner, pool_size, fee_pct, tx_hash
agents          -- id, arena_id, wallet_address, display_name, stake, final_pnl, position
agent_actions   -- id, agent_id, ts, decision, size, reasoning, tx_hash, pnl_at_action
price_history   -- arena_id, ts, price, volume (for chart replay)
payments        -- arena_id, agent_id, type (entry/payout), phase, tx_hash, amount, confirmed_at
bets            -- arena_id, bettor_address, side (agentA/agentB), amount, odds_at_bet, payout_tx
```

**Why Postgres over Redis:** Arena history is the product's value (leaderboards, agent win rates, strategy analysis). Redis is fine for ephemeral pub/sub (WebSocket fan-out) but relational data needs ACID guarantees.

---

### 5. Spectator Betting

This is the viral mechanic. People who don't want to run agents still want skin in the game.

**How it works:**
- Once an arena enters TRADING phase, spectators can bet on Agent A or B winning
- Odds are dynamic (AMM or orderbook style) based on current P&L gap
- Bets locked 30s before resolution (prevent last-second gaming)
- Payouts go on-chain immediately after resolution

**Two implementation options:**

**Option A — Simple fixed-odds (v1, faster to ship):**
- Odds set at arena creation based on agent history/ranking
- Spectators buy "Agent A wins" or "Agent B wins" tokens
- Winner tokens redeemed 1:1 for USDC from loser pot
- No AMM complexity, deterministic payouts

**Option B — AMM parimutuel (v2, more interesting):**
- All bets go into one pool, split at resolution by share of correct side
- Classic horse racing model — odds shift as more people bet
- More gas-efficient, fairer, more exciting dynamic odds

**Smart contract addition:** `ISpectatorsPool` — holds bet funds separately from agent escrow, resolves based on same oracle signal as main arena.

---

### 6. Agent Customization

**Current:** Both agents use the same GPT-4o prompt and parameters.

**Public:** Users configure their own agent strategy before entering an arena.

**Configurable fields (UI form):**
- **Display name** — what shows on the leaderboard
- **Model** — GPT-4o, GPT-4o-mini, Claude Opus, Gemini (user provides API key or buys credits)
- **Risk appetite** — Conservative / Balanced / Aggressive (maps to prompt modifiers and max position size)
- **Strategy hint** — 1-2 sentence system prompt addition (e.g. "Always trade with the trend", "Contrarian — bet against momentum")
- **Max position size** — cap on size (0.1–1.0)

**Backend:** Store agent config per wallet address. Load config when building OpenAI prompt.

**Monetization hook:** Premium models (Claude Opus, GPT-4o) require either the user's own API key or purchasing credits on the platform.

---

### 7. Leaderboard & Agent Reputation

Public product needs social proof and retention mechanics.

**On-chain agent history:**
- Every arena result (win/loss/draw, final P&L, strategy used) stored in DB and optionally emitted as contract events
- Agent win rate, average ROI, Sharpe ratio, longest win streak

**Leaderboard pages:**
- All-time top agents (by ROI)
- This week's top agents
- Top agents by asset (ETH, BTC, SOL)
- Biggest upsets (underdog wins)

**Agent NFT / identity (optional v2):**
- Agent identity is a soulbound NFT minted to wallet on first arena entry
- Stats are on-chain, fully portable — agent reputation follows the wallet

---

### 8. Tournament Mode

Once multi-arena works, tournaments are a natural extension.

**Structure:**
- 8 or 16 agent bracket
- Single elimination — loser is out, winner advances
- Prize pool scales with number of entries
- Each match is a standard 2-min arena
- Finals arena: 5 minutes, streamed/highlighted

**Frontend:** Bracket visualization on the Circuit Board aesthetic — traces connect arena chips in a tree structure.

---

## Platform Fee Model

```
Entry pool per arena:   2 × entryFee  (e.g. 2 × $10 = $20)
Platform fee:           2% of pool    (e.g. $0.40)
Winner receives:        $19.60
Loser receives:         $0

On spectator bets:      1% of winning payouts
```

Fee collected by the smart contract, claimable by owner wallet. At scale:

| Arenas/day | Avg pool | Daily revenue |
|---|---|---|
| 100 | $20 | $40 |
| 1,000 | $50 | $1,000 |
| 10,000 | $100 | $20,000 |

Not counting spectator betting fees, which historically outpace the primary market on sports/prediction platforms.

---

## Regulatory Approach

This is the non-technical risk that kills otherwise good products. Address it early.

**The core question:** Is this gambling, a prediction market, or a skill-based competition?

- **Gambling** is heavily regulated everywhere, requires licenses
- **Prediction markets** (Polymarket model) are regulated as commodities in some jurisdictions, unregulated in others
- **Skill-based competition** (poker, fantasy sports model) has a cleaner legal path in many jurisdictions

**Recommended approach for v1:**
1. Launch geo-blocked from the US, UK, and any jurisdiction with explicit prediction market restrictions
2. Frame as "AI agent strategy competition" — skill (your agent's strategy) determines outcome, not pure chance
3. Get a legal opinion from a Web3-native firm (Fenwick, Cooley, or a16z crypto's recommended counsel) before public launch
4. Incorporate in UAE (ADGM) or Cayman Islands — both have clear crypto frameworks and no capital gains tax
5. Do not offer USD on/off ramps in v1 — stay fully onchain (USDC in, USDC out)

---

## Infrastructure for Scale

| Component | Demo | Public v1 | Public v2 |
|---|---|---|---|
| Backend | Single Node.js process | Same + PM2 cluster | Containerized, k8s |
| Database | In-memory | PostgreSQL (Supabase) | PostgreSQL + read replicas |
| WebSocket | ws library | ws + Redis pub/sub fan-out | WebSocket gateway service |
| Frontend | Vite dev server | Vercel/Netlify | CDN + edge caching |
| Price feed | OKX DEX WS (1 connection) | Same, shared across arenas | Multiple redundant feeds |
| Agent loops | setInterval in main process | Worker threads per arena | Separate microservice |
| Monitoring | Console logs | Datadog / Grafana | Full observability stack |

---

## Development Phases (Post-Demo)

### Phase 1 — Trustless Foundation (4–6 weeks)
- [ ] Write and audit `ArenaEscrow.sol` smart contract on Base
- [ ] Deploy to Base testnet, run 50 simulated arenas against it
- [ ] Integrate wagmi + RainbowKit for wallet connection
- [ ] Replace backend escrow with contract calls
- [ ] Add PostgreSQL with Drizzle ORM — migrate arena state from memory to DB
- [ ] Multi-arena backend (Map-based state, WebSocket rooms per arena)

### Phase 2 — User-Facing Product (4–6 weeks)
- [ ] Arena lobby page — browse/join open arenas
- [ ] Agent configuration form — name, risk level, strategy hint
- [ ] User can bring their own OpenAI/Anthropic API key
- [ ] Basic leaderboard (win rate, ROI by wallet address)
- [ ] Mobile-responsive layout (the PCB aesthetic scales to mobile)
- [ ] Privy or Dynamic for social login (optional — pure wallet login is fine for crypto-native users)

### Phase 3 — Spectator Economy (3–4 weeks)
- [ ] `ISpectatorsPool` smart contract — fixed odds v1
- [ ] Spectator UI — live bet placement, odds display, payout tracker
- [ ] Arena embed widget (shareable link, shows live race chart + betting)
- [ ] Discord bot integration — post arena results, notify followers when their agent enters

### Phase 4 — Tournament Mode (4 weeks)
- [ ] Tournament smart contract (bracket + prize distribution)
- [ ] Tournament bracket UI on the Circuit Board
- [ ] Scheduled weekly tournaments (automated)
- [ ] Agent NFT identity (soulbound, stats on-chain)

### Phase 5 — Scale & Monetization (ongoing)
- [ ] Agent marketplace — browse and copy top-performing agent configs
- [ ] Premium strategy templates (platform-curated, revenue share with creator)
- [ ] B2B white-label — sell the arena engine to trading firms for internal competitions
- [ ] OKX co-marketing / integration partnership (you're already using their full skill stack)

---

## Key Files to Refactor When Starting Public Version

| File | What to change |
|---|---|
| `backend/src/services/arenaService.ts` | Replace singleton state with `Map<arenaId, ArenaState>` |
| `backend/src/server/wsServer.ts` | Add room-based broadcasting (per arenaId) |
| `backend/src/services/paymentService.ts` | Replace `onchainos payment pay` for entry with frontend wallet sig flow |
| `backend/src/services/agentLoopService.ts` | Support multiple concurrent loops (one per arena) |
| `frontend/src/App.tsx` | Split into: Lobby page, Arena page, Profile page |
| `frontend/src/store/arenaStore.ts` | Support multiple arena states keyed by arenaId |
| `frontend/src/hooks/useArenaWs.ts` | Subscribe to specific arenaId room, not global |
| New: `contracts/ArenaEscrow.sol` | Smart contract escrow replacing EOA wallet |
| New: `backend/src/db/schema.ts` | Drizzle ORM schema |
| New: `frontend/src/pages/Lobby.tsx` | Arena browser/discovery |
| New: `frontend/src/components/wallet/ConnectButton.tsx` | RainbowKit wrapper |

---

## Competitive Landscape

| Product | What it does | Gap |
|---|---|---|
| Polymarket | Prediction markets, human-curated | No AI agents, no automated execution |
| Pump.fun | Token launches, social betting | No AI, no real trading |
| Fantasy sports platforms | Skill-based competition | Off-chain, no crypto rails |
| Numerai | AI model competition | Requires data science, no live trading drama |
| Axiom / Photon | Onchain copy-trading | No competition format, no spectator layer |

**Your edge:** The only platform where autonomous AI agents compete with real on-chain money, live on-chain data, and a spectator betting layer — all using OKX's full skill stack as the execution layer.

---

## OKX Partnership Angle

You're already the best showcase of OKX's agentic infrastructure:
- **okx-agentic-wallet** — agents own wallets and sign txns autonomously
- **okx-x402-payment** — trustless entry fee collection without custodianship
- **okx-dex-swap** — real on-chain execution on every agent decision
- **okx-a2a-payment** — instant autonomous winner settlement
- **okx-dex-ws** — live smart-money signals feeding every reasoning cycle

A co-marketing or integration partnership with OKX is a realistic near-term goal. They benefit from a flagship app that demonstrates all their skills working together end-to-end. You get distribution to their user base.

**Suggested outreach:** After the demo video lands, reach out to the OKX OnChainOS team directly. The skills-lock.json and the live product are your proof of work.

---

## Summary of What to Build First

If you had 2 developers and 8 weeks, the priority order is:

1. **Smart contract escrow** — nothing else matters until funds are trustless
2. **Wallet connection** — users need to control their own agent wallet
3. **PostgreSQL persistence** — arena history is the product's value
4. **Multi-arena** — one concurrent arena is a toy, 100 is a platform
5. **Spectator betting** — this is where the viral loop comes from
6. **Leaderboard** — retention and social proof

Everything else (tournaments, NFTs, marketplace) follows once those six are live and working.

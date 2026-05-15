# onchainos CLI — Command Reference

`onchainos` is OKX's OnChainOS CLI. It powers all OKX skills — wallet management, DEX swaps, payments, market data, and more. All commands that move funds require an active wallet session.

**Version:** 3.3.2  
**Install:** `curl -sSL https://raw.githubusercontent.com/okx/onchainos-skills/v3.3.2/install.sh | sh`  
**Upgrade:** `onchainos upgrade`

---

## Commands Used In This Project

These are the commands the Agent Trading Arena backend calls directly.

### Install & Verify
```bash
# Install (run once)
curl -sSL "https://raw.githubusercontent.com/okx/onchainos-skills/v3.3.2/install.sh" -o /tmp/onchainos-install.sh
sh /tmp/onchainos-install.sh

# Reload PATH after install
source ~/.zshrc

# Verify install
onchainos --version
```

### Wallet Login (required before running the server)
```bash
# Step 1 — send OTP to your email
onchainos wallet login your@email.com

# Step 2 — verify OTP received in email
onchainos wallet verify 123456

# Add a second account (Agent B)
onchainos wallet add
# follow same OTP flow

# Check login status
onchainos wallet status

# Show all wallet addresses (EVM/Base/Solana)
onchainos wallet addresses

# Switch between accounts
onchainos wallet switch
```

### Entry Fee Payment (x402)
```bash
# Sign an EIP-3009 USDC payment for an HTTP 402-gated resource
# Used by paymentService.ts to pay arena entry fees
onchainos payment pay \
  --accepts '<JSON accepts array from 402 response>'

# Local-key fallback (uses EVM_PRIVATE_KEY env var — no TEE)
onchainos payment pay-local \
  --accepts '<JSON accepts array from 402 response>'
```

### DEX Swap (agent trading decisions)
```bash
# Get a quote (read-only, no signing)
onchainos swap quote \
  --from <token-address> \
  --to <token-address> \
  --readable-amount <amount> \
  --chain base

# One-shot swap: quote → approve → sign → broadcast → returns txHash
# Used by okxSwapService.ts on every LONG/SHORT agent decision
onchainos swap execute \
  --from <token-address> \
  --to <token-address> \
  --readable-amount <amount> \
  --chain base \
  --wallet <agent-wallet-address> \
  --slippage 0.5

# Example: Agent goes LONG (USDC → WETH on Base)
onchainos swap execute \
  --from 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 \
  --to 0x4200000000000000000000000000000000000006 \
  --readable-amount 5 \
  --chain base \
  --wallet 0x64ff724b66fb8c1044f1d069b76a53c282e4658d \
  --slippage 0.5

# Example: Agent goes SHORT (WETH → USDC on Base)
onchainos swap execute \
  --from 0x4200000000000000000000000000000000000006 \
  --to 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 \
  --readable-amount 0.001 \
  --chain base \
  --wallet 0x64ff724b66fb8c1044f1d069b76a53c282e4658d \
  --slippage 0.5
```

### A2A Payment (winner payout)
```bash
# Seller: create a payment link (escrow → winner)
# Used by paymentService.ts after market resolves
onchainos payment a2a-pay create \
  --amount 2 \
  --symbol USDT \
  --recipient <winner-wallet-address> \
  --description "Arena payout" \
  --expires-in 300

# Buyer: pay the link (triggers on-chain settlement)
onchainos payment a2a-pay pay \
  --payment-id a2a_xxx

# Check payment status (auto-polled every 3s for 60s)
onchainos payment a2a-pay status \
  --payment-id a2a_xxx
```

### Wallet Balance & Transfers
```bash
# Check balance of your agentic wallet
onchainos wallet balance --chain base

# Send funds back to your personal wallet
onchainos wallet send \
  --to 0xYOUR_PERSONAL_WALLET \
  --amount 1 \
  --symbol USDC \
  --chain base

# Send native ETH
onchainos wallet send \
  --to 0xYOUR_PERSONAL_WALLET \
  --amount 0.001 \
  --chain base
```

---

## Full Command Reference

### `onchainos wallet` — Agentic Wallet

```bash
onchainos wallet login [email]          # Login: OTP to email, or AK login (no email)
onchainos wallet verify <otp>           # Submit OTP code after login
onchainos wallet add                    # Add a second wallet account
onchainos wallet switch                 # Switch between accounts
onchainos wallet status                 # Show current login state + account info
onchainos wallet addresses              # Show addresses for all chains (EVM, Solana, etc.)
onchainos wallet balance                # Query token balances
onchainos wallet send                   # Send native token or ERC-20
onchainos wallet history                # Transaction history
onchainos wallet logout                 # Clear all credentials
onchainos wallet chains                 # List all supported chains
onchainos wallet sign-message           # Sign a message (personalSign / EIP-712)
onchainos wallet contract-call          # Call a smart contract
onchainos wallet gas-station            # Manage Gas Station (pay gas with stablecoins)
onchainos wallet qrcode <address>       # Print QR code for an address
```

---

### `onchainos swap` — DEX Aggregator

Aggregates 500+ DEX sources for best routing across 20+ chains.

```bash
onchainos swap quote \
  --from <token> --to <token> \
  --readable-amount <amount> \
  --chain <chain>                       # Read-only price estimate

onchainos swap execute \
  --from <token> --to <token> \
  --readable-amount <amount> \
  --chain <chain> \
  --wallet <address> \
  [--slippage <pct>] \
  [--gas-level average|fast|slow] \
  [--mev-protection]                    # Full swap: quote→approve→sign→broadcast

onchainos swap swap \
  --from <token> --to <token> \
  --readable-amount <amount> \
  --chain <chain> \
  --wallet <address>                    # Calldata only — does NOT broadcast

onchainos swap approve \
  --token <address> \
  --amount <amount> \
  --chain <chain>                       # ERC-20 approval tx data

onchainos swap check-approvals          # Check existing token allowances
onchainos swap chains                   # List supported chains
onchainos swap liquidity --chain <chain># List liquidity sources on a chain
```

**Common token addresses on Base:**
| Token | Address |
|---|---|
| USDC | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Native ETH | `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` |

---

### `onchainos payment` — Payment Protocols

```bash
# x402 — pay an HTTP 402-gated API (TEE signing)
onchainos payment pay \
  --accepts '<accepts JSON array>'

# x402 — pay with local private key (EVM_PRIVATE_KEY env var)
onchainos payment pay-local \
  --accepts '<accepts JSON array>'

# A2A Pay — create payment link (seller)
onchainos payment a2a-pay create \
  --amount <decimal> \
  --symbol <USDT|USDC> \
  --recipient <address> \
  [--description <text>] \
  [--expires-in <seconds>]

# A2A Pay — pay a payment link (buyer)
onchainos payment a2a-pay pay \
  --payment-id <a2a_xxx>

# A2A Pay — query status
onchainos payment a2a-pay status \
  --payment-id <a2a_xxx>

# MPP one-shot charge
onchainos payment charge

# MPP session channel (open/voucher/topup/close)
onchainos payment session

# Manage default payment asset
onchainos payment default
```

**A2A payment status values:**
| Status | Meaning |
|---|---|
| `pending` | Awaiting buyer signature |
| `settling` | Signed, confirming on-chain |
| `completed` | On-chain confirmed, funds sent |
| `failed` | Payment failed |
| `expired` | Link expired before payment |
| `cancelled` | Cancelled by seller |

---

### `onchainos market` — Market Data

```bash
onchainos market price \
  --token <contract-address> \
  --chain <chain>                       # Current token price

onchainos market prices \
  --tokens <addr1,addr2> \
  --chain <chain>                       # Batch token prices

onchainos market kline \
  --token <address> \
  --chain <chain> \
  --interval 1m                         # Candlestick / K-line data

onchainos market index --token <symbol> # Aggregated index price

onchainos market portfolio-overview \
  --address <wallet>                    # Wallet PnL overview

onchainos market portfolio-dex-history \
  --address <wallet>                    # DEX trade history

onchainos market portfolio-recent-pnl \
  --address <wallet>                    # Recent token PnL records
```

---

### `onchainos signal` — Smart Money Signals

```bash
onchainos signal list \
  --chain <chain>                       # Latest whale/KOL/smart-money signals

onchainos signal chains                 # Supported chains for signals
```

---

### `onchainos token` — Token Intelligence

```bash
onchainos token search \
  --query <symbol-or-name> \
  --chains <chain>                      # Find token address by symbol

onchainos token info \
  --token <address> \
  --chain <chain>                       # Name, symbol, decimals, logo

onchainos token price-info \
  --token <address> \
  --chain <chain>                       # Price, market cap, liquidity, 24h change

onchainos token advanced-info \
  --token <address> \
  --chain <chain>                       # Risk, creator stats, holder concentration

onchainos token holders \
  --token <address> \
  --chain <chain>                       # Top 100 holders

onchainos token hot-tokens \
  --chain <chain>                       # Trending tokens

onchainos token top-trader \
  --token <address> \
  --chain <chain>                       # Top profitable traders for a token

onchainos token report \
  --token <address> \
  --chain <chain>                       # Full report: info + price + risk + security
```

---

### `onchainos security` — Security Scanning

```bash
onchainos security token-scan \
  --tokens "8453:0x..."                 # Scan tokens for honeypot, high tax, rug risk

onchainos security dapp-scan \
  --url <dapp-url>                      # Scan a DApp URL for phishing

onchainos security tx-scan \
  --chain <chain> \
  --tx-hash <hash>                      # Pre/post execution tx security scan

onchainos security approvals \
  --address <wallet> \
  --chain <chain>                       # List all token approvals for a wallet

onchainos security sig-scan \
  --message <hex>                       # Scan a signature for phishing risk
```

---

### `onchainos portfolio` — Public Wallet Portfolio

```bash
onchainos portfolio total-value \
  --address <wallet>                    # Total USD value across all tokens

onchainos portfolio all-balances \
  --address <wallet>                    # All token balances

onchainos portfolio token-balances \
  --address <wallet> \
  --tokens <addr1,addr2>                # Specific token balances

onchainos portfolio chains              # Supported chains
```

---

### `onchainos ws` — WebSocket Subscriptions

```bash
onchainos ws channels                   # List all available WebSocket channels
onchainos ws channel-info <channel>     # Details for a specific channel

onchainos ws start \
  --channel <channel> \
  --params <json>                       # Start background WS session → returns session ID

onchainos ws poll --id <session-id>     # Poll events from a running session
onchainos ws stop --id <session-id>     # Stop a session (omit --id to stop all)
onchainos ws list                       # List all running sessions
```

---

### `onchainos cross-chain` — Bridge

```bash
onchainos cross-chain quote \
  --from-chain <chain> \
  --to-chain <chain> \
  --from-token <address> \
  --to-token <address> \
  --amount <amount>                     # Cross-chain bridge quote

onchainos cross-chain execute \
  --from-chain <chain> \
  --to-chain <chain> \
  --from-token <address> \
  --to-token <address> \
  --amount <amount> \
  --wallet <address>                    # Execute cross-chain bridge

onchainos cross-chain status \
  --tx-hash <hash>                      # Check bridge status

onchainos cross-chain bridges           # List available bridge protocols
onchainos cross-chain tokens            # List bridgeable tokens
```

---

### `onchainos strategy` — Limit Orders

```bash
onchainos strategy create-limit \
  --from <token> --to <token> \
  --amount <amount> \
  --price <trigger-price> \
  --chain <chain> \
  --wallet <address>                    # Place a price-triggered limit order

onchainos strategy list                 # List open limit orders
onchainos strategy cancel --id <id>     # Cancel a limit order
onchainos strategy resume --id <id>     # Resume a suspended order
```

---

### `onchainos defi` — DeFi Protocols

```bash
onchainos defi search \
  --query <protocol-or-token>           # Search DeFi products (earn, pools, lending)

onchainos defi invest \
  --product-id <id> \
  --amount <amount> \
  --wallet <address>                    # Deposit into a DeFi product

onchainos defi withdraw \
  --product-id <id> \
  --wallet <address>                    # Withdraw from a DeFi product

onchainos defi positions \
  --wallet <address>                    # All DeFi positions across protocols

onchainos defi list                     # Browse all DeFi products
```

---

### `onchainos tracker` — Address Tracker

```bash
onchainos tracker activities \
  --addresses <addr1,addr2>             # Latest DEX activity for tracked wallets
                                        # (smart money, KOL, or custom addresses)
```

---

### `onchainos memepump` — Meme Token Scanner

```bash
onchainos memepump                      # Scan pump.fun and meme tokens
```

---

### `onchainos leaderboard` — Top Traders

```bash
onchainos leaderboard                   # Top traders ranked by PnL, win rate, or volume
```

---

## Global Flags

These work on every command:

```bash
--chain <chain>         # Target chain: base, ethereum, bsc, arbitrum, solana, etc.
--base-url <url>        # Override backend URL
--help                  # Show help for any command
--version               # Print CLI version
```

---

## This Project's Wallet Addresses (Base Mainnet)

| Role | Address |
|---|---|
| Agent A (ALPHA-7) | `0x64ff724b66fb8c1044f1d069b76a53c282e4658d` |
| Agent B (OMEGA-3) | `0xbcedcaf511eda0dc8ed57ded5f81fb00eeba8ece` |
| Escrow | `0x7e672453A08ca08c8419E3c76b3fa8afa0E0BF7F` |

**Base USDC:** `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`  
**Base WETH:** `0x4200000000000000000000000000000000000006`

---

## Quick Troubleshoot

| Problem | Fix |
|---|---|
| `command not found: onchainos` | `source ~/.zshrc` or use `~/.local/bin/onchainos` |
| `An API key is required` | Use email login: `onchainos wallet login email@example.com` |
| `Not logged in` | Run `onchainos wallet login` before starting the server |
| Swap fails with approval error | Wait 3s for Base block confirmation, retry automatically |
| A2A payment stuck on `settling` | Normal — poll `status` again after 5–10s |

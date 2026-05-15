import 'dotenv/config';

// Supported values: "testnet" | "base" | "mainnet"
const NETWORK = process.env.NETWORK ?? 'testnet';

const NETWORK_CONFIGS = {
  testnet: {
    chainId: 11155111,
    chainIndex: '11155111',
    caip2: 'eip155:11155111',
    // Circle official USDC on Sepolia (FiatToken v2.2, supports EIP-3009)
    usdcAddress: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    // WETH on Sepolia
    defaultAssetContract: '0x7b79995e5f793a07bc00c21412e50ecae098e7f9',
    label: 'Ethereum Sepolia',
  },
  base: {
    chainId: 8453,
    chainIndex: '8453',
    caip2: 'eip155:8453',
    // Circle official USDC on Base (FiatToken v2.2, supports EIP-3009)
    usdcAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    // WETH on Base
    defaultAssetContract: '0x4200000000000000000000000000000000000006',
    label: 'Base Mainnet',
  },
  mainnet: {
    chainId: 1,
    chainIndex: '1',
    caip2: 'eip155:1',
    // Circle official USDC on Ethereum mainnet
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    // WETH on Ethereum mainnet
    defaultAssetContract: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    label: 'Ethereum Mainnet',
  },
} as const;

type NetworkKey = keyof typeof NETWORK_CONFIGS;

const net = (NETWORK_CONFIGS[NETWORK as NetworkKey] ?? NETWORK_CONFIGS.testnet);

export const config = {
  network: NETWORK,
  networkLabel: net.label,
  isTestnet: NETWORK === 'testnet',
  isBase: NETWORK === 'base',
  isMainnet: NETWORK === 'mainnet',
  chainId: net.chainId,
  chainIndex: net.chainIndex,
  caip2: net.caip2,
  usdcAddress: net.usdcAddress,
  targetAsset: {
    symbol: process.env.TARGET_ASSET_SYMBOL ?? 'ETH',
    chainIndex: process.env.TARGET_CHAIN_INDEX ?? net.chainIndex,
    tokenContractAddress: process.env.TARGET_ASSET_CONTRACT ?? net.defaultAssetContract,
  },
  port: Number(process.env.PORT ?? 3001),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  okx: {
    apiKey: process.env.OKX_API_KEY ?? '',
    secretKey: process.env.OKX_SECRET_KEY ?? '',
    passphrase: process.env.OKX_PASSPHRASE ?? '',
    wsUrl: 'wss://wsdex.okx.com/ws/v6/dex',
    restBaseUrl: 'https://www.okx.com',
  },
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  agentWallets: {
    agentA: process.env.AGENT_A_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000001',
    agentB: process.env.AGENT_B_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000002',
  },
  escrowWallet: process.env.ARENA_ESCROW_WALLET ?? '0x0000000000000000000000000000000000000003',
  agentTickIntervalMs: 10_000,
  priceHistoryMaxLen: 200,
  signalHistoryMaxLen: 5,
} as const;

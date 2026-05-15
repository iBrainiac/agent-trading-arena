import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { config } from '../config';

const execAsync = promisify(exec);

export interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

async function runSwap(
  fromToken: string,
  toToken: string,
  amount: string,
  walletAddress: string,
  attempt = 1,
): Promise<SwapResult> {
  try {
    const cmd = [
      'onchainos swap execute',
      `--from-token ${fromToken}`,
      `--to-token ${toToken}`,
      `--amount ${amount}`,
      `--wallet ${walletAddress}`,
      `--chain-index ${config.chainIndex}`,
      '--slippage 0.5',
    ].join(' ');

    logger.info(`Swap attempt ${attempt}: ${cmd}`);
    const { stdout } = await execAsync(cmd, { timeout: 60_000 });

    const match = stdout.match(/txHash[:\s]+([0-9a-fA-Fx]+)/i);
    const txHash = match?.[1];
    if (txHash) {
      logger.info(`Swap success: ${txHash}`);
      return { success: true, txHash };
    }

    if (stdout.includes('approval') || stdout.includes('pending')) {
      if (attempt < 3) {
        const blockTimeMs = config.isMainnet ? 12_000 : 15_000;
        await new Promise((r) => setTimeout(r, blockTimeMs));
        return runSwap(fromToken, toToken, amount, walletAddress, attempt + 1);
      }
    }

    logger.warn('Swap no txHash in output', { stdout });
    return { success: false, error: 'No txHash in output' };
  } catch (err) {
    logger.error('Swap error', err);
    return { success: false, error: String(err) };
  }
}

export async function executeSwap(
  direction: 'LONG' | 'SHORT',
  amountUsdt: string,
  walletAddress: string,
): Promise<SwapResult> {
  const usdcAddr = config.usdcAddress;
  const assetAddr = config.targetAsset.tokenContractAddress;

  const fromToken = direction === 'LONG' ? usdcAddr : assetAddr;
  const toToken = direction === 'LONG' ? assetAddr : usdcAddr;

  return runSwap(fromToken, toToken, amountUsdt, walletAddress);
}

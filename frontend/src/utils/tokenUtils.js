import { RpcProvider, num, Contract } from 'starknet';

/**
 * Common Starknet Sepolia token addresses
 */
export const STARKNET_TOKENS = {
  ETH: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
  STRK: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
  // Add more tokens as needed
};

/**
 * ERC20 ABI for balanceOf and decimals
 */
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'felt' }],
    outputs: [{ name: 'balance', type: 'Uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'decimals', type: 'felt' }],
    stateMutability: 'view',
  },
  {
    name: 'name',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'name', type: 'felt' }],
    stateMutability: 'view',
  },
  {
    name: 'symbol',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'symbol', type: 'felt' }],
    stateMutability: 'view',
  },
];

/**
 * Get token balance for a Starknet address
 * @param {string} tokenAddress - Token contract address
 * @param {string} walletAddress - User wallet address
 * @param {RpcProvider} provider - Optional RPC provider
 * @returns {Promise<object>} Token balance info
 */
export async function getStarknetTokenBalance(tokenAddress, walletAddress, provider = null) {
  try {
    const rpcUrl = import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2';
    const rpcProvider = provider || new RpcProvider({ nodeUrl: rpcUrl });

    // Call balanceOf
    const result = await rpcProvider.callContract({
      contractAddress: tokenAddress,
      entrypoint: 'balanceOf',
      calldata: [walletAddress]
    });

    // Parse Uint256 result (low, high)
    const balanceLow = BigInt(result[0]);
    const balanceHigh = result[1] ? BigInt(result[1]) : 0n;
    const balance = balanceLow + (balanceHigh << 128n);

    // Get decimals (default 18 for ETH)
    let decimals = 18;
    try {
      const decimalsResult = await rpcProvider.callContract({
        contractAddress: tokenAddress,
        entrypoint: 'decimals',
        calldata: []
      });
      decimals = parseInt(num.hexToDecimalString(decimalsResult[0]));
    } catch (e) {
      console.warn('Could not fetch decimals, using default 18:', e);
    }

    // Format balance
    const formatted = Number(balance) / Math.pow(10, decimals);

    return {
      address: tokenAddress,
      balance: balance.toString(),
      formatted: formatted.toFixed(6),
      decimals
    };
  } catch (error) {
    console.error('Error fetching token balance:', error);
    throw error;
  }
}

/**
 * Get multiple token balances for a wallet
 * @param {string} walletAddress - User wallet address
 * @param {Array<string>} tokenAddresses - Array of token contract addresses
 * @returns {Promise<Array>} Array of token balances
 */
export async function getMultipleTokenBalances(walletAddress, tokenAddresses = null) {
  const tokens = tokenAddresses || Object.values(STARKNET_TOKENS);
  const rpcUrl = import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2';
  const provider = new RpcProvider({ nodeUrl: rpcUrl });

  const balances = await Promise.allSettled(
    tokens.map(tokenAddress => getStarknetTokenBalance(tokenAddress, walletAddress, provider))
  );

  return balances
    .map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          ...result.value,
          symbol: Object.keys(STARKNET_TOKENS).find(
            key => STARKNET_TOKENS[key] === tokens[index]
          ) || 'UNKNOWN'
        };
      } else {
        return {
          address: tokens[index],
          balance: '0',
          formatted: '0.000000',
          decimals: 18,
          symbol: 'ERROR',
          error: result.reason?.message || 'Failed to fetch'
        };
      }
    });
}

/**
 * Get ETH balance for a Starknet wallet
 * @param {string} walletAddress - User wallet address
 * @returns {Promise<object>} ETH balance info
 */
export async function getStarknetEthBalance(walletAddress) {
  return getStarknetTokenBalance(STARKNET_TOKENS.ETH, walletAddress);
}

/**
 * Get STRK balance for a Starknet wallet
 * @param {string} walletAddress - User wallet address
 * @returns {Promise<object>} STRK balance info
 */
export async function getStarknetStrkBalance(walletAddress) {
  return getStarknetTokenBalance(STARKNET_TOKENS.STRK, walletAddress);
}

/**
 * Format token balance for display
 * @param {string|BigInt} balance - Raw balance
 * @param {number} decimals - Token decimals
 * @param {number} precision - Display precision
 * @returns {string} Formatted balance
 */
export function formatTokenBalance(balance, decimals = 18, precision = 6) {
  const balanceBigInt = typeof balance === 'string' ? BigInt(balance) : balance;
  const formatted = Number(balanceBigInt) / Math.pow(10, decimals);
  return formatted.toFixed(precision);
}

// Deployed Contract Addresses (StarkNet Sepolia)
export const CONTRACTS = {
  // Main on-chain escrow with ZK verification
  LOAN_ESCROW_ZK: '0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d',
  
  // ZK proof verification contract
  ACTIVITY_VERIFIER: '0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be',
  
  // STRK token (Sepolia testnet)
  STRK_TOKEN: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
};

export const NETWORK = 'sepolia';
export const RPC_URL = 'https://starknet-sepolia.public.blastapi.io';

// Legacy contract addresses (kept for reference, not used)
export const LEGACY_CONTRACTS = {
  LOAN_ESCROW_V2: '0x027c616b8d507d2cb4e62a07cd25c5f5a5f5b7c649e916f57897a52936a53d19'
};

module.exports = {
  starknet: {
    goerli: {
      rpc: process.env.STARKNET_RPC,
      network: 'goerli-alpha',
      chainId: '0x534e5f474f45524c49'
    },
    mainnet: {
      rpc: process.env.STARKNET_RPC,
      network: 'mainnet-alpha',
      chainId: '0x534e5f4d41494e'
    }
  },
  evm: {
    goerli: {
      rpc: process.env.EVM_RPC,
      chainId: 5,
      name: 'goerli'
    },
    mainnet: {
      rpc: process.env.EVM_RPC,
      chainId: 1,
      name: 'mainnet'
    }
  },
  getCurrentStarkNetNetwork() {
    const network = process.env.STARKNET_NETWORK || 'goerli-alpha';
    return this.starknet[network.split('-')[0]] || this.starknet.goerli;
  },
  getCurrentEVMNetwork() {
    return this.evm.goerli;
  }
};

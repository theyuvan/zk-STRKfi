const { RpcProvider, Account, Contract } = require('starknet');
const { ethers } = require('ethers');
const logger = require('./logger');

class RPCClient {
  constructor() {
    // StarkNet provider
    this.starknetProvider = new RpcProvider({
      nodeUrl: process.env.STARKNET_RPC
    });

    // EVM provider
    if (process.env.EVM_RPC) {
      this.evmProvider = new ethers.JsonRpcProvider(process.env.EVM_RPC);
    }
  }

  // Get StarkNet contract instance
  getStarkNetContract(contractAddress, abi) {
    try {
      return new Contract(abi, contractAddress, this.starknetProvider);
    } catch (error) {
      logger.error('Failed to initialize StarkNet contract', {
        address: contractAddress,
        error: error.message
      });
      throw error;
    }
  }

  // Get EVM contract instance
  getEVMContract(contractAddress, abi) {
    try {
      if (!this.evmProvider) {
        throw new Error('EVM provider not configured');
      }
      return new ethers.Contract(contractAddress, abi, this.evmProvider);
    } catch (error) {
      logger.error('Failed to initialize EVM contract', {
        address: contractAddress,
        error: error.message
      });
      throw error;
    }
  }

  // Call StarkNet contract read function
  async callStarkNet(contractAddress, abi, functionName, params = []) {
    try {
      const contract = this.getStarkNetContract(contractAddress, abi);
      const result = await contract.call(functionName, params);
      return result;
    } catch (error) {
      logger.error('StarkNet call failed', {
        contract: contractAddress,
        function: functionName,
        error: error.message
      });
      throw error;
    }
  }

  // Call EVM contract read function
  async callEVM(contractAddress, abi, functionName, params = []) {
    try {
      const contract = this.getEVMContract(contractAddress, abi);
      const result = await contract[functionName](...params);
      return result;
    } catch (error) {
      logger.error('EVM call failed', {
        contract: contractAddress,
        function: functionName,
        error: error.message
      });
      throw error;
    }
  }

  // Get StarkNet block number
  async getStarkNetBlockNumber() {
    try {
      const block = await this.starknetProvider.getBlock('latest');
      return block.block_number;
    } catch (error) {
      logger.error('Failed to get StarkNet block number', { error: error.message });
      throw error;
    }
  }

  // Get EVM block number
  async getEVMBlockNumber() {
    try {
      if (!this.evmProvider) {
        throw new Error('EVM provider not configured');
      }
      return await this.evmProvider.getBlockNumber();
    } catch (error) {
      logger.error('Failed to get EVM block number', { error: error.message });
      throw error;
    }
  }
}

module.exports = new RPCClient();

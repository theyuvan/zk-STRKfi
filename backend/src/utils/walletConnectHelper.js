const logger = require('./logger');

/**
 * Helper functions for wallet signature requests
 * NOTE: Actual signing happens client-side; these are utilities for message formatting
 */

class WalletConnectHelper {
  /**
   * Generate a message for client-side signature
   * @param {string} action - Action being performed
   * @param {object} data - Data to include in message
   * @returns {object} Message object for signing
   */
  generateSignatureMessage(action, data) {
    const timestamp = Date.now();
    const message = {
      action,
      timestamp,
      data,
      domain: 'zk-affordability-loan',
      version: '1'
    };
    
    logger.info('Generated signature message', { action, timestamp });
    return message;
  }

  /**
   * Format StarkNet typed data for signing
   * @param {string} action - Action type
   * @param {object} data - Data to sign
   * @returns {object} StarkNet typed data
   */
  formatStarkNetTypedData(action, data) {
    return {
      types: {
        StarkNetDomain: [
          { name: 'name', type: 'felt' },
          { name: 'version', type: 'felt' },
          { name: 'chainId', type: 'felt' }
        ],
        Message: [
          { name: 'action', type: 'felt' },
          { name: 'timestamp', type: 'felt' },
          { name: 'data', type: 'felt' }
        ]
      },
      primaryType: 'Message',
      domain: {
        name: 'ZKAffordabilityLoan',
        version: '1',
        chainId: process.env.STARKNET_NETWORK === 'mainnet' ? '0x534e5f4d41494e' : '0x534e5f474f45524c49'
      },
      message: {
        action,
        timestamp: Date.now().toString(),
        data: JSON.stringify(data)
      }
    };
  }

  /**
   * Format EIP-712 typed data for EVM signing
   * @param {string} action - Action type
   * @param {object} data - Data to sign
   * @returns {object} EIP-712 typed data
   */
  formatEIP712TypedData(action, data) {
    return {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' }
        ],
        Message: [
          { name: 'action', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'data', type: 'string' }
        ]
      },
      primaryType: 'Message',
      domain: {
        name: 'ZKAffordabilityLoan',
        version: '1',
        chainId: 5 // Goerli
      },
      message: {
        action,
        timestamp: Date.now(),
        data: JSON.stringify(data)
      }
    };
  }

  /**
   * Verify signature message timestamp is recent (within 5 minutes)
   * @param {number} timestamp - Timestamp from message
   * @returns {boolean} True if timestamp is valid
   */
  verifyTimestamp(timestamp) {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const isValid = now - timestamp < maxAge;
    
    if (!isValid) {
      logger.warn('Signature timestamp expired', { timestamp, now });
    }
    
    return isValid;
  }
}

module.exports = new WalletConnectHelper();

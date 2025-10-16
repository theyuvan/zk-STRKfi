const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const COMMITMENTS_FILE = path.join(__dirname, '../data/identity_commitments.json');

class IdentityCommitmentStore {
  cache = null;

  constructor() {
    this.ensureFileExists();
  }

  /**
   * Ensure the JSON file exists
   */
  async ensureFileExists() {
    try {
      await fs.access(COMMITMENTS_FILE);
    } catch (error) {
      // File doesn't exist, create it
      const initialData = {
        commitments: {},
        metadata: {
          created: new Date().toISOString(),
          description: 'Stores identity commitments mapped to wallet addresses',
        },
      };
      await fs.writeFile(COMMITMENTS_FILE, JSON.stringify(initialData, null, 2));
      logger.info('📝 Created identity commitments storage file');
    }
  }

  /**
   * Load commitments from file
   */
  async load() {
    try {
      const data = await fs.readFile(COMMITMENTS_FILE, 'utf8');
      this.cache = JSON.parse(data);
      return this.cache;
    } catch (error) {
      logger.error('❌ Failed to load commitments:', error.message);
      throw error;
    }
  }

  /**
   * Save commitments to file
   */
  async save() {
    try {
      await fs.writeFile(COMMITMENTS_FILE, JSON.stringify(this.cache, null, 2));
      logger.info('💾 Saved identity commitments to file');
    } catch (error) {
      logger.error('❌ Failed to save commitments:', error.message);
      throw error;
    }
  }

  /**
   * Store identity commitment for a wallet address
   * @param {string} walletAddress - Wallet address (0x...)
   * @param {string} identity_commitment - Identity commitment from identity proof
   * @param {string} activity_commitment - Activity commitment from loan proof (optional)
   */
  async storeIdentityCommitment(walletAddress, identity_commitment, activity_commitment = null) {
    try {
      await this.load();

      const now = new Date().toISOString();
      
      if (!this.cache.commitments[walletAddress]) {
        // New entry
        this.cache.commitments[walletAddress] = {
          identity_commitment,
          activity_commitment: activity_commitment || null,
          created_at: now,
          updated_at: now,
        };
        logger.info('✅ Stored NEW identity commitment for wallet:', {
          wallet: walletAddress.slice(0, 10) + '...',
          identity_commitment: identity_commitment.slice(0, 20) + '...',
        });
      } else {
        // Update existing
        this.cache.commitments[walletAddress].identity_commitment = identity_commitment;
        if (activity_commitment) {
          this.cache.commitments[walletAddress].activity_commitment = activity_commitment;
        }
        this.cache.commitments[walletAddress].updated_at = now;
        logger.info('✅ Updated identity commitment for wallet:', {
          wallet: walletAddress.slice(0, 10) + '...',
        });
      }

      await this.save();
      return true;
    } catch (error) {
      logger.error('❌ Failed to store identity commitment:', error.message);
      throw error;
    }
  }

  /**
   * Store activity commitment for a wallet address
   * @param {string} walletAddress - Wallet address (0x...)
   * @param {string} activity_commitment - Activity commitment from loan proof
   */
  async storeActivityCommitment(walletAddress, activity_commitment) {
    try {
      await this.load();

      const now = new Date().toISOString();

      if (!this.cache.commitments[walletAddress]) {
        // New entry (activity before identity - unusual but possible)
        this.cache.commitments[walletAddress] = {
          identity_commitment: null,
          activity_commitment,
          created_at: now,
          updated_at: now,
        };
        logger.info('✅ Stored activity commitment (no identity yet) for wallet:', {
          wallet: walletAddress.slice(0, 10) + '...',
        });
      } else {
        // Update existing
        this.cache.commitments[walletAddress].activity_commitment = activity_commitment;
        this.cache.commitments[walletAddress].updated_at = now;
        logger.info('✅ Updated activity commitment for wallet:', {
          wallet: walletAddress.slice(0, 10) + '...',
        });
      }

      await this.save();
      return true;
    } catch (error) {
      logger.error('❌ Failed to store activity commitment:', error.message);
      throw error;
    }
  }

  /**
   * Get identity commitment by wallet address
   * @param {string} walletAddress - Wallet address (0x...)
   * @returns {object|null} { identity_commitment, activity_commitment, created_at, updated_at }
   */
  async getCommitmentsByWallet(walletAddress) {
    try {
      await this.load();
      const data = this.cache.commitments[walletAddress];
      
      if (!data) {
        logger.warn('⚠️ No commitments found for wallet:', walletAddress.slice(0, 10) + '...');
        return null;
      }

      logger.info('✅ Retrieved commitments for wallet:', {
        wallet: walletAddress.slice(0, 10) + '...',
        has_identity: !!data.identity_commitment,
        has_activity: !!data.activity_commitment,
      });

      return data;
    } catch (error) {
      logger.error('❌ Failed to get commitments:', error.message);
      throw error;
    }
  }

  /**
   * Find wallet address by activity commitment
   * (Used during reveal - we know activity_commitment from contract, need to find identity_commitment)
   * @param {string} activity_commitment - Activity commitment (0x...)
   * @returns {object|null} { walletAddress, identity_commitment, activity_commitment, created_at, updated_at }
   */
  async findWalletByActivityCommitment(activity_commitment) {
    try {
      await this.load();

      // Normalize commitment (ensure 0x prefix)
      const normalizedCommitment = activity_commitment.startsWith('0x') 
        ? activity_commitment 
        : '0x' + activity_commitment;

      // Search through all wallets
      for (const [walletAddress, data] of Object.entries(this.cache.commitments)) {
        if (data.activity_commitment === normalizedCommitment) {
          logger.info('✅ Found wallet for activity commitment:', {
            wallet: walletAddress.slice(0, 10) + '...',
            activity: normalizedCommitment.slice(0, 20) + '...',
            has_identity: !!data.identity_commitment,
          });

          return {
            walletAddress,
            ...data,
          };
        }
      }

      logger.warn('⚠️ No wallet found for activity commitment:', normalizedCommitment.slice(0, 20) + '...');
      return null;
    } catch (error) {
      logger.error('❌ Failed to find wallet by activity commitment:', error.message);
      throw error;
    }
  }

  /**
   * Get all stored commitments (for debugging)
   */
  async getAllCommitments() {
    try {
      await this.load();
      return this.cache.commitments;
    } catch (error) {
      logger.error('❌ Failed to get all commitments:', error.message);
      throw error;
    }
  }

  /**
   * Get stats
   */
  async getStats() {
    try {
      await this.load();
      const totalWallets = Object.keys(this.cache.commitments).length;
      let walletsWithIdentity = 0;
      let walletsWithActivity = 0;
      let walletsWithBoth = 0;

      for (const data of Object.values(this.cache.commitments)) {
        if (data.identity_commitment) walletsWithIdentity++;
        if (data.activity_commitment) walletsWithActivity++;
        if (data.identity_commitment && data.activity_commitment) walletsWithBoth++;
      }

      return {
        totalWallets,
        walletsWithIdentity,
        walletsWithActivity,
        walletsWithBoth,
      };
    } catch (error) {
      logger.error('❌ Failed to get stats:', error.message);
      return { totalWallets: 0, walletsWithIdentity: 0, walletsWithActivity: 0, walletsWithBoth: 0 };
    }
  }
}

// Export singleton instance
module.exports = new IdentityCommitmentStore();

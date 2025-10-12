/**
 * ZK Proof Cache Manager
 * Manages proof caching and dynamic updates based on wallet activity
 * Prevents redundant proof generation for same wallet state
 */

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY_PREFIX = 'zkproof_cache_';

export class ZKProofCacheManager {
  constructor() {
    this.memoryCache = new Map();
  }

  /**
   * Get cached proof for wallet or generate new one if needed
   * @param {string} walletAddress - StarkNet wallet address
   * @param {object} currentMetrics - Current wallet metrics
   * @param {Function} generateProofFn - Function to generate new proof
   * @returns {Promise<object>} Cached or newly generated proof
   */
  async getOrUpdateProof(walletAddress, currentMetrics, generateProofFn) {
    console.log('🔍 Checking proof cache for:', walletAddress);

    // Try memory cache first
    let cached = this.memoryCache.get(walletAddress);

    // Fallback to localStorage
    if (!cached) {
      cached = this.loadFromLocalStorage(walletAddress);
      if (cached) {
        this.memoryCache.set(walletAddress, cached);
      }
    }

    // Check if cache is valid
    const shouldRegenerate = this.shouldRegenerateProof(cached, currentMetrics);

    if (shouldRegenerate) {
      console.log('♻️  Regenerating proof (cache invalid or outdated)');
      const newProof = await generateProofFn();
      
      // Cache the new proof
      this.cacheProof(walletAddress, newProof, currentMetrics);
      
      return {
        ...newProof,
        cached: false,
        reason: this.getRegenerationReason(cached, currentMetrics)
      };
    }

    console.log('✅ Using cached proof');
    return {
      ...cached,
      cached: true
    };
  }

  /**
   * Determine if proof should be regenerated
   * @private
   */
  shouldRegenerateProof(cached, currentMetrics) {
    // No cache exists
    if (!cached) {
      return true;
    }

    // Cache expired
    if (Date.now() > cached.expiresAt) {
      console.log('⏰ Proof cache expired');
      return true;
    }

    // Activity score changed (new transactions)
    if (cached.activityScore !== currentMetrics.activityScore) {
      console.log('📊 Activity score changed:', {
        old: cached.activityScore,
        new: currentMetrics.activityScore
      });
      return true;
    }

    // Transaction count changed
    if (cached.txCount !== currentMetrics.txCount) {
      console.log('📈 Transaction count changed:', {
        old: cached.txCount,
        new: currentMetrics.txCount
      });
      return true;
    }

    // Latest transaction hash changed (new tx detected)
    if (cached.lastTxHash !== currentMetrics.lastTxHash) {
      console.log('🆕 New transaction detected:', currentMetrics.lastTxHash);
      return true;
    }

    return false;
  }

  /**
   * Get reason for proof regeneration
   * @private
   */
  getRegenerationReason(cached, currentMetrics) {
    if (!cached) return 'no_cache';
    if (Date.now() > cached.expiresAt) return 'expired';
    if (cached.activityScore !== currentMetrics.activityScore) return 'score_changed';
    if (cached.txCount !== currentMetrics.txCount) return 'tx_count_changed';
    if (cached.lastTxHash !== currentMetrics.lastTxHash) return 'new_transaction';
    return 'unknown';
  }

  /**
   * Cache a proof with wallet state
   * @param {string} walletAddress - Wallet address
   * @param {object} proof - ZK proof data
   * @param {object} metrics - Current wallet metrics
   */
  cacheProof(walletAddress, proof, metrics) {
    const cacheEntry = {
      walletAddress,
      proof: proof.proof,
      publicSignals: proof.publicSignals,
      commitment: proof.commitment,
      
      // Wallet state at time of proof generation
      activityScore: metrics.activityScore,
      txCount: metrics.txCount,
      totalVolume: metrics.totalVolume,
      lastTxHash: metrics.lastTxHash,
      
      // Cache metadata
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION,
      version: '1.0'
    };

    // Store in memory
    this.memoryCache.set(walletAddress, cacheEntry);

    // Store in localStorage
    this.saveToLocalStorage(walletAddress, cacheEntry);

    console.log('💾 Proof cached for:', walletAddress, {
      expiresIn: this.formatDuration(CACHE_DURATION),
      activityScore: metrics.activityScore,
      txCount: metrics.txCount
    });
  }

  /**
   * Manually invalidate cache for a wallet
   * @param {string} walletAddress - Wallet address
   */
  invalidateCache(walletAddress) {
    console.log('🗑️  Invalidating cache for:', walletAddress);
    
    this.memoryCache.delete(walletAddress);
    
    const key = STORAGE_KEY_PREFIX + walletAddress;
    localStorage.removeItem(key);
  }

  /**
   * Clear all cached proofs
   */
  clearAllCache() {
    console.log('🗑️  Clearing all proof cache');
    
    this.memoryCache.clear();
    
    // Clear localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getCacheStats() {
    const allCached = this.getAllCachedWallets();
    const now = Date.now();

    const stats = {
      totalCached: allCached.length,
      memoryCount: this.memoryCache.size,
      storageCount: allCached.length,
      expired: allCached.filter(c => c.expiresAt < now).length,
      valid: allCached.filter(c => c.expiresAt >= now).length,
      wallets: allCached.map(c => ({
        address: c.walletAddress,
        score: c.activityScore,
        txCount: c.txCount,
        age: this.formatDuration(now - c.timestamp),
        expiresIn: c.expiresAt > now 
          ? this.formatDuration(c.expiresAt - now)
          : 'expired'
      }))
    };

    return stats;
  }

  /**
   * Load cached proof from localStorage
   * @private
   */
  loadFromLocalStorage(walletAddress) {
    try {
      const key = STORAGE_KEY_PREFIX + walletAddress;
      const data = localStorage.getItem(key);
      
      if (!data) return null;

      const cached = JSON.parse(data);
      
      // Validate cache structure
      if (!cached.proof || !cached.publicSignals || !cached.commitment) {
        console.warn('⚠️  Invalid cache structure, removing');
        localStorage.removeItem(key);
        return null;
      }

      return cached;
    } catch (error) {
      console.error('❌ Failed to load cache from localStorage:', error);
      return null;
    }
  }

  /**
   * Save proof to localStorage
   * @private
   */
  saveToLocalStorage(walletAddress, cacheEntry) {
    try {
      const key = STORAGE_KEY_PREFIX + walletAddress;
      const data = JSON.stringify(cacheEntry);
      localStorage.setItem(key, data);
    } catch (error) {
      console.error('❌ Failed to save cache to localStorage:', error);
      
      // Handle quota exceeded
      if (error.name === 'QuotaExceededError') {
        console.warn('⚠️  localStorage quota exceeded, clearing old caches');
        this.clearExpiredCache();
      }
    }
  }

  /**
   * Get all cached wallets from localStorage
   * @private
   */
  getAllCachedWallets() {
    const cached = [];
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        try {
          const data = localStorage.getItem(key);
          const entry = JSON.parse(data);
          cached.push(entry);
        } catch (error) {
          console.warn('⚠️  Failed to parse cache entry:', key);
        }
      }
    });

    return cached;
  }

  /**
   * Clear expired cache entries
   * @private
   */
  clearExpiredCache() {
    const now = Date.now();
    const allCached = this.getAllCachedWallets();

    allCached.forEach(entry => {
      if (entry.expiresAt < now) {
        this.invalidateCache(entry.walletAddress);
      }
    });

    console.log('🗑️  Cleared expired cache entries');
  }

  /**
   * Format duration in human-readable format
   * @private
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Log cache activity to console (for debugging)
   */
  logCacheActivity() {
    const stats = this.getCacheStats();
    
    console.log('📊 ZK Proof Cache Statistics:');
    console.table(stats.wallets);
    console.log({
      'Total Cached': stats.totalCached,
      'Valid': stats.valid,
      'Expired': stats.expired,
      'In Memory': stats.memoryCount
    });
  }
}

// Export singleton instance
export const zkProofCache = new ZKProofCacheManager();

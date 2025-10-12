const axios = require('axios');
const FormData = require('form-data');
const forge = require('node-forge');
const logger = require('../utils/logger');

class IPFSService {
  constructor() {
    this.pinataApiKey = process.env.IPFS_API_KEY;
    this.pinataSecretKey = process.env.IPFS_API_SECRET;
    this.pinataJWT = process.env.IPFS_JWT;
    this.gateway = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
    this.pinataBaseUrl = 'https://api.pinata.cloud';
  }

  /**
   * Initialize IPFS client (no-op for Pinata HTTP API)
   */
  initialize() {
    logger.info('IPFS service initialized with Pinata');
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {object} data - Data to encrypt
   * @param {string} password - Encryption password (derived from secret)
   * @returns {object} { encrypted, iv, tag, salt }
   */
  encryptData(data, password) {
    try {
      const salt = forge.random.getBytesSync(32);
      const key = forge.pkcs5.pbkdf2(password, salt, 100000, 32);
      const iv = forge.random.getBytesSync(12);

      const cipher = forge.cipher.createCipher('AES-GCM', key);
      cipher.start({ iv: iv });
      cipher.update(forge.util.createBuffer(JSON.stringify(data), 'utf8'));
      cipher.finish();

      const encrypted = cipher.output.toHex();
      const tag = cipher.mode.tag.toHex();

      logger.info('Data encrypted successfully');

      return {
        encrypted,
        iv: forge.util.encode64(iv),
        tag,
        salt: forge.util.encode64(salt)
      };
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {object} encryptedData - Encrypted data object
   * @param {string} password - Decryption password
   * @returns {object} Decrypted data
   */
  decryptData(encryptedData, password) {
    try {
      const { encrypted, iv, tag, salt } = encryptedData;

      const saltBytes = forge.util.decode64(salt);
      const key = forge.pkcs5.pbkdf2(password, saltBytes, 100000, 32);
      const ivBytes = forge.util.decode64(iv);

      const decipher = forge.cipher.createDecipher('AES-GCM', key);
      decipher.start({
        iv: ivBytes,
        tag: forge.util.hexToBytes(tag)
      });
      decipher.update(forge.util.createBuffer(forge.util.hexToBytes(encrypted)));
      
      const success = decipher.finish();
      if (!success) {
        throw new Error('Authentication tag verification failed');
      }

      const decrypted = JSON.parse(decipher.output.toString('utf8'));
      logger.info('Data decrypted successfully');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Upload encrypted data to IPFS via Pinata
   * @param {object} encryptedData - Encrypted data to upload
   * @returns {string} IPFS CID
   */
  async uploadToIPFS(encryptedData) {
    try {
      const data = JSON.stringify({
        pinataContent: encryptedData,
        pinataMetadata: {
          name: `loan-data-${Date.now()}.json`
        }
      });

      const response = await axios.post(
        `${this.pinataBaseUrl}/pinning/pinJSONToIPFS`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.pinataJWT}`
          }
        }
      );

      const cid = response.data.IpfsHash;
      logger.info('Uploaded to IPFS via Pinata', { cid });

      return cid;
    } catch (error) {
      logger.error('IPFS upload failed', { error: error.message });
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Retrieve data from IPFS via Pinata gateway
   * @param {string} cid - IPFS CID
   * @returns {object} Retrieved data
   */
  async retrieveFromIPFS(cid) {
    try {
      const url = `${this.gateway}${cid}`;
      const response = await axios.get(url);

      logger.info('Retrieved from IPFS', { cid });

      return response.data;
    } catch (error) {
      logger.error('IPFS retrieval failed', { cid, error: error.message });
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }

  /**
   * Pin existing CID to ensure persistence
   * @param {string} cid - IPFS CID to pin
   * @returns {boolean} Success status
   */
  async pinCID(cid) {
    try {
      this.initialize();
      await this.client.pin.add(cid);
      logger.info('Pinned CID', { cid });
      return true;
    } catch (error) {
      logger.error('Pin failed', { cid, error: error.message });
      throw new Error(`Pin failed: ${error.message}`);
    }
  }

  /**
   * Get IPFS gateway URL for a CID
   * @param {string} cid - IPFS CID
   * @returns {string} Gateway URL
   */
  getGatewayURL(cid) {
    return `${this.gateway}${cid}`;
  }
}

module.exports = new IPFSService();

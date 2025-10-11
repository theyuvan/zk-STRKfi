const axios = require('axios');

class PinService {
  constructor() {
    this.apiKey = process.env.IPFS_API_KEY;
    this.apiSecret = process.env.IPFS_API_SECRET;
    this.baseUrl = 'https://api.pinata.cloud';
  }

  /**
   * Test authentication with Pinata
   */
  async testAuthentication() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/data/testAuthentication`,
        {
          headers: {
            pinata_api_key: this.apiKey,
            pinata_secret_api_key: this.apiSecret
          }
        }
      );

      console.log('✓ Pinata authentication successful');
      return response.data;
    } catch (error) {
      console.error('✗ Pinata authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Pin JSON to IPFS
   */
  async pinJSON(data, name) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/pinning/pinJSONToIPFS`,
        {
          pinataContent: data,
          pinataMetadata: { name }
        },
        {
          headers: {
            pinata_api_key: this.apiKey,
            pinata_secret_api_key: this.apiSecret,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✓ Pinned to IPFS: ${response.data.IpfsHash}`);
      return response.data.IpfsHash;
    } catch (error) {
      console.error('✗ Failed to pin JSON:', error.message);
      throw error;
    }
  }

  /**
   * Check pin status
   */
  async getPinList(filters = {}) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/data/pinList`,
        {
          params: filters,
          headers: {
            pinata_api_key: this.apiKey,
            pinata_secret_api_key: this.apiSecret
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('✗ Failed to get pin list:', error.message);
      throw error;
    }
  }

  /**
   * Unpin content from IPFS
   */
  async unpin(hash) {
    try {
      await axios.delete(
        `${this.baseUrl}/pinning/unpin/${hash}`,
        {
          headers: {
            pinata_api_key: this.apiKey,
            pinata_secret_api_key: this.apiSecret
          }
        }
      );

      console.log(`✓ Unpinned: ${hash}`);
      return true;
    } catch (error) {
      console.error('✗ Failed to unpin:', error.message);
      throw error;
    }
  }
}

module.exports = new PinService();

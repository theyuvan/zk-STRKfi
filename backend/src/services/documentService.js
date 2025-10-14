const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Document Verification Service
 * Handles passport/document uploads and creates cryptographic hashes
 * No mock data - real document processing
 */

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/documents');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF allowed.'), false);
  }
};

// Multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

/**
 * Hash document photo using SHA-256
 * @param {string} filePath - Path to uploaded document
 * @returns {Promise<string>} - Hex hash of document
 */
async function hashDocument(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => {
      hash.update(data);
    });
    
    stream.on('end', () => {
      const documentHash = hash.digest('hex');
      logger.info('Document hashed successfully', { hash: documentHash });
      resolve(documentHash);
    });
    
    stream.on('error', (err) => {
      logger.error('Error hashing document', { error: err.message });
      reject(err);
    });
  });
}

/**
 * Hash passport number using SHA-256
 * @param {string} passportNumber - Passport number from form
 * @returns {string} - Hex hash of passport number
 */
function hashPassportNumber(passportNumber) {
  const hash = crypto.createHash('sha256')
    .update(passportNumber)
    .digest('hex');
  
  logger.info('Passport number hashed', { hash: hash.substring(0, 16) + '...' });
  return hash;
}

/**
 * Hash address using SHA-256
 * @param {string} address - Full address from form
 * @returns {string} - Hex hash of address
 */
function hashAddress(address) {
  // Normalize address (remove extra spaces, lowercase)
  const normalized = address.trim().toLowerCase().replace(/\s+/g, ' ');
  
  const hash = crypto.createHash('sha256')
    .update(normalized)
    .digest('hex');
  
  logger.info('Address hashed', { hash: hash.substring(0, 16) + '...' });
  return hash;
}

/**
 * Convert date of birth to Unix timestamp
 * @param {string} dobString - Date string (YYYY-MM-DD)
 * @returns {number} - Unix timestamp
 */
function dobToTimestamp(dobString) {
  const date = new Date(dobString);
  const timestamp = Math.floor(date.getTime() / 1000);
  
  logger.info('DOB converted to timestamp', { dob: dobString, timestamp });
  return timestamp;
}

/**
 * Calculate age from timestamp
 * @param {number} dobTimestamp - DOB as Unix timestamp
 * @returns {number} - Age in years
 */
function calculateAge(dobTimestamp) {
  const now = Math.floor(Date.now() / 1000);
  const ageSeconds = now - dobTimestamp;
  const ageYears = ageSeconds / (365.25 * 24 * 60 * 60);
  
  return Math.floor(ageYears);
}

/**
 * Generate random salt for ZK proof
 * @returns {string} - Random hex string
 */
function generateSalt() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Convert hex hash to field element (felt252 compatible)
 * Starknet felt252 max: 2^251 - 1
 * @param {string} hexHash - Hex hash string (with or without 0x prefix)
 * @returns {string} - Felt-compatible number string
 */
function hexToFelt(hexHash) {
  // Remove 0x prefix if present
  const cleaned = hexHash.startsWith('0x') ? hexHash.slice(2) : hexHash;
  
  // Take first 62 hex chars (31 bytes) to ensure it fits in felt252
  const truncated = cleaned.substring(0, 62);
  const bigInt = BigInt('0x' + truncated);
  
  // Ensure it's less than felt252 max (2^251 - 1)
  const felt252Max = BigInt('0x800000000000011000000000000000000000000000000000000000000000000');
  
  if (bigInt >= felt252Max) {
    // If too large, take modulo
    return (bigInt % felt252Max).toString();
  }
  
  return bigInt.toString();
}

/**
 * Process identity document and prepare ZK proof inputs
 * @param {Object} formData - Form data from frontend
 * @param {string} documentPath - Path to uploaded document
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<Object>} - ZK proof inputs
 */
async function processIdentityDocument(formData, documentPath, walletAddress) {
  try {
    logger.info('Processing identity document', { wallet: walletAddress });
    
    // 1. Hash document photo
    const documentPhotoHash = await hashDocument(documentPath);
    
    // 2. Hash passport number
    const passportHash = hashPassportNumber(formData.passportNumber);
    
    // 3. Hash address
    const addressHash = hashAddress(formData.address);
    
    // 4. Convert DOB to timestamp
    const dobTimestamp = dobToTimestamp(formData.dateOfBirth);
    
    // 5. Verify age >= 18
    const age = calculateAge(dobTimestamp);
    if (age < 18) {
      throw new Error(`Age verification failed. Must be 18+. Current age: ${age}`);
    }
    
    // 6. Generate salt
    const salt = generateSalt();
    
    // 7. Current timestamp for proof verification
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // 8. Convert all hashes to felt252-compatible format
    const zkInputs = {
      // Private inputs
      passport_number: hexToFelt(passportHash),
      address_hash: hexToFelt(addressHash),
      dob_timestamp: dobTimestamp.toString(),
      document_photo_hash: hexToFelt(documentPhotoHash),
      salt: hexToFelt(salt),
      wallet_address: hexToFelt(walletAddress), // Convert wallet address to felt252
      
      // Public inputs
      current_timestamp: currentTimestamp.toString(),
      
      // Metadata (not used in circuit)
      age: age,
      verified: age >= 18
    };
    
    logger.info('Identity ZK inputs prepared', {
      wallet: walletAddress,
      age: age,
      verified: zkInputs.verified
    });
    
    return {
      success: true,
      zkInputs: zkInputs,
      metadata: {
        age: age,
        documentHash: documentPhotoHash,
        passportHash: passportHash,
        addressHash: addressHash,
        timestamp: currentTimestamp
      }
    };
    
  } catch (error) {
    logger.error('Error processing identity document', { error: error.message });
    throw error;
  }
}

/**
 * Delete uploaded document (for privacy)
 * @param {string} filePath - Path to document
 */
function deleteDocument(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('Document deleted', { path: filePath });
    }
  } catch (error) {
    logger.error('Error deleting document', { error: error.message });
  }
}

module.exports = {
  upload,
  hashDocument,
  hashPassportNumber,
  hashAddress,
  dobToTimestamp,
  calculateAge,
  generateSalt,
  hexToFelt,
  processIdentityDocument,
  deleteDocument
};

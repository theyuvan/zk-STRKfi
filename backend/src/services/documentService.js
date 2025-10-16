const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { PDFParse } = require('pdf-parse'); // ✅ v2 API

/**
 * Document Verification Service with OCR Parsing
 * Handles passport/document uploads, OCR text extraction, and validation
 * Ensures uploaded document data matches user inputs
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
 * Parse document using OCR (Tesseract.js)
 * Extracts text from image documents
 * @param {string} filePath - Path to document image
 * @returns {Promise<Object>} - Parsed text and confidence
 */
async function parseDocumentWithOCR(filePath) {
  try {
    logger.info('🔍 Starting OCR parsing...', { file: path.basename(filePath) });

    // Enhance image for better OCR results
    const enhancedImagePath = filePath + '.enhanced.png';
    await sharp(filePath)
      .greyscale()
      .normalize()
      .sharpen()
      .toFile(enhancedImagePath);

    // Perform OCR
    const { data } = await Tesseract.recognize(enhancedImagePath, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          logger.info(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    // Clean up enhanced image
    if (fs.existsSync(enhancedImagePath)) {
      fs.unlinkSync(enhancedImagePath);
    }

    logger.info('✅ OCR parsing completed', {
      confidence: data.confidence,
      textLength: data.text.length
    });

    return {
      text: data.text,
      confidence: data.confidence,
      lines: data.lines.map(line => line.text),
      words: data.words.map(word => word.text)
    };
  } catch (error) {
    logger.error('❌ OCR parsing failed', { error: error.message });
    throw new Error(`OCR parsing failed: ${error.message}`);
  }
}

/**
 * Parse PDF document
 * Extracts text from PDF files
 * @param {string} filePath - Path to PDF document
 * @returns {Promise<Object>} - Parsed text
 */
async function parsePDFDocument(filePath) {
  let parser = null;
  try {
    logger.info('📄 Parsing PDF document...', { file: path.basename(filePath) });

    const dataBuffer = fs.readFileSync(filePath);
    
    // ✅ pdf-parse v2 API
    parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();

    logger.info('✅ PDF parsing completed', {
      pages: result.pages,
      textLength: result.text.length
    });

    return {
      text: result.text,
      pages: result.pages,
      lines: result.text.split('\n').filter(line => line.trim())
    };
  } catch (error) {
    logger.error('❌ PDF parsing failed', { error: error.message });
    throw new Error(`PDF parsing failed: ${error.message}`);
  } finally {
    // ✅ Cleanup parser resources (v2 API requirement)
    if (parser) {
      try {
        await parser.destroy();
      } catch (cleanupError) {
        logger.warn('⚠️ PDF parser cleanup failed (non-critical)', { error: cleanupError.message });
      }
    }
  }
}

/**
 * Extract identity information from parsed text
 * Searches for passport number, address, and DOB patterns
 * @param {Object} parsedData - Parsed document text
 * @returns {Object} - Extracted identity data
 */
function extractIdentityData(parsedData) {
  const text = parsedData.text || '';
  const lines = parsedData.lines || [];

  logger.info('🔎 Extracting identity data from parsed text...');

  const extracted = {
    passportNumbers: [],
    addresses: [],
    dates: [],
    names: []
  };

  // Passport number patterns (various formats)
  const passportPatterns = [
    /\b[A-Z]{1,2}\d{6,9}\b/g,  // US: A12345678
    /\b\d{9}\b/g,               // Numeric: 123456789
    /\b[A-Z]\d{7}\b/g,          // UK: A1234567
    /\b[A-Z]{2}\d{7}\b/g        // EU: AB1234567
  ];

  passportPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      extracted.passportNumbers.push(...matches);
    }
  });

  // Date patterns (DOB) - Extract with context filtering
  const datePatterns = [
    /(\d{1,2})\.?[\/\.\-](\d{1,2})[\/\.\-](\d{4})/g,  // DD./MM/YYYY or DD/MM/YYYY (handles OCR artifacts like "16./10/2005")
    /\b(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})\b/g   // YYYY-MM-DD
  ];

  // Look for DOB specifically near keywords
  const dobKeywords = ['birth', 'dob', 'date of birth', 'born', 'd.o.b'];
  const currentYear = new Date().getFullYear();

  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase();
    
    // Check if line contains DOB keywords
    const hasDOBKeyword = dobKeywords.some(keyword => lowerLine.includes(keyword));
    
    if (hasDOBKeyword) {
      // Extract dates from this line and next 2 lines
      const contextLines = [line, lines[idx + 1] || '', lines[idx + 2] || ''].join(' ');
      
      datePatterns.forEach(pattern => {
        const matches = contextLines.match(pattern);
        if (matches) {
          matches.forEach(dateStr => {
            // Parse and validate date
            const parsedDate = parseDate(dateStr);
            if (parsedDate) {
              const year = parsedDate.getFullYear();
              // Only accept dates that are plausible birth dates (1900-2010, not future dates)
              if (year >= 1900 && year <= 2010 && year < currentYear) {
                extracted.dates.push(dateStr);
              }
            }
          });
        }
      });
    }
  });

  // If no DOB found with keywords, extract all dates but filter by plausibility
  if (extracted.dates.length === 0) {
    logger.info('🔍 No DOB found near keywords, scanning all text for birth dates...');
    
    datePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        logger.info('📅 Found date candidates:', { matches });
        matches.forEach(dateStr => {
          const parsedDate = parseDate(dateStr);
          if (parsedDate) {
            const year = parsedDate.getFullYear();
            logger.info('📆 Parsing date:', { 
              dateStr, 
              year, 
              valid: year >= 1900 && year <= 2010 
            });
            // Only dates between 1900-2010 (plausible birth years)
            if (year >= 1900 && year <= 2010) {
              extracted.dates.push(dateStr);
              logger.info('✅ Added as potential DOB:', { dateStr });
            }
          }
        });
      }
    });
  }
  
  // Helper: Parse date string to Date object
  function parseDate(dateStr) {
    try {
      // Clean OCR artifacts (like "16./10/2005" -> "16/10/2005")
      const cleanedDate = dateStr.replace(/\.([\/\-])/g, '$1').replace(/\.\./g, '.');
      
      // Try different formats
      const formats = [
        // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (handles "16./10/2005" after cleaning)
        /^(\d{1,2})\.?[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/,
        // YYYY/MM/DD or YYYY-MM-DD
        /^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/
      ];
      
      for (const format of formats) {
        const match = cleanedDate.match(format);
        if (match) {
          if (match[0].startsWith('1') || match[0].startsWith('2')) {
            // YYYY-MM-DD format
            const date = new Date(match[1], match[2] - 1, match[3]);
            logger.info('📅 Parsed as YYYY-MM-DD:', { 
              original: dateStr, 
              cleaned: cleanedDate, 
              year: match[1], 
              month: match[2], 
              day: match[3],
              result: date.toISOString()
            });
            return date;
          } else {
            // DD/MM/YYYY format (assume European/Indian format)
            const date = new Date(match[3], match[2] - 1, match[1]);
            logger.info('📅 Parsed as DD/MM/YYYY:', { 
              original: dateStr, 
              cleaned: cleanedDate, 
              day: match[1], 
              month: match[2], 
              year: match[3],
              result: date.toISOString()
            });
            return date;
          }
        }
      }
      
      // Fallback to Date constructor
      return new Date(cleanedDate);
    } catch (err) {
      logger.warn('⚠️ Date parsing failed:', { dateStr, error: err.message });
      return null;
    }
  }

  // Address patterns (lines with street, city, zip, or common address indicators)
  const addressKeywords = [
    'street', 'st', 'avenue', 'ave', 'road', 'rd', 'lane', 'ln', 'drive', 'dr',
    'city', 'state', 'zip', 'pin', 'postal', 'address', 'addr',
    'no:', 'old no', 'new no', 'building', 'apartment', 'apt', 'floor',
    'nagar', 'colony', 'sector', 'block' // Indian address terms
  ];
  
  // Extract lines that look like addresses
  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase();
    const trimmedLine = line.trim();
    
    // Skip very short lines or lines with mostly special characters
    if (trimmedLine.length < 10 || trimmedLine.replace(/[^a-zA-Z0-9]/g, '').length < 5) {
      return;
    }
    
    // Check for address keywords
    const hasKeyword = addressKeywords.some(keyword => lowerLine.includes(keyword));
    
    // Check for address-like patterns (contains numbers and letters)
    const hasNumbers = /\d/.test(trimmedLine);
    const hasComma = trimmedLine.includes(',');
    
    if (hasKeyword || (hasNumbers && hasComma)) {
      extracted.addresses.push(trimmedLine);
      
      // Also check next 2 lines for multi-line addresses
      if (idx + 1 < lines.length) {
        const nextLine = lines[idx + 1].trim();
        if (nextLine.length > 5 && !extracted.addresses.includes(nextLine)) {
          extracted.addresses.push(nextLine);
        }
      }
    }
  });

  // Name patterns (typically at the beginning of documents)
  const namePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
  const nameMatches = text.match(namePattern);
  if (nameMatches && nameMatches.length > 0) {
    extracted.names = nameMatches.slice(0, 5); // First 5 name-like patterns
  }

  logger.info('📋 Extraction results:', {
    passportNumbers: extracted.passportNumbers.length,
    dates: extracted.dates.length,
    addresses: extracted.addresses.length,
    names: extracted.names.length
  });

  return extracted;
}

/**
 * Validate user input against parsed document data
 * Ensures uploaded document matches provided information
 * @param {Object} userInput - Data from form
 * @param {Object} extractedData - Data parsed from document
 * @param {number} minConfidence - Minimum OCR confidence (default: 60)
 * @returns {Object} - Validation result
 */
function validateDocumentData(userInput, extractedData, parsedData, minConfidence = 60) {
  logger.info('🔐 Validating document data against user inputs...');

  const validationResult = {
    isValid: false,
    confidence: parsedData.confidence || 100,
    errors: [],
    warnings: [],
    matches: {}
  };

  // Check OCR confidence
  if (parsedData.confidence && parsedData.confidence < minConfidence) {
    validationResult.warnings.push(
      `OCR confidence is low (${Math.round(parsedData.confidence)}%). Document may be unclear.`
    );
  }

  // Validate passport number with OCR-tolerant fuzzy matching
  if (userInput.passportNumber) {
    const inputPassport = userInput.passportNumber.trim().toUpperCase().replace(/[\s-]/g, '');
    
    // Helper: Calculate Levenshtein distance for OCR errors
    const levenshtein = (a, b) => {
      const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
      for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1,
            matrix[j - 1][i - 1] + cost
          );
        }
      }
      return matrix[b.length][a.length];
    };

    // Try exact match or substring match first
    let found = extractedData.passportNumbers.some(extracted => {
      const cleanExtracted = extracted.toUpperCase().replace(/[\s-]/g, '');
      return cleanExtracted === inputPassport || 
             cleanExtracted.includes(inputPassport) || 
             inputPassport.includes(cleanExtracted);
    });

    // If no exact match, try fuzzy matching (allow 1-2 OCR errors)
    if (!found) {
      const maxErrors = Math.min(2, Math.floor(inputPassport.length * 0.2)); // 20% error tolerance
      found = extractedData.passportNumbers.some(extracted => {
        const cleanExtracted = extracted.toUpperCase().replace(/[\s-]/g, '');
        const distance = levenshtein(inputPassport, cleanExtracted);
        if (distance <= maxErrors) {
          logger.info('✅ Passport matched with fuzzy matching', { 
            input: inputPassport, 
            extracted: cleanExtracted, 
            distance 
          });
          return true;
        }
        return false;
      });
    }

    if (found) {
      validationResult.matches.passport = true;
      logger.info('✅ Passport number validated');
    } else if (extractedData.passportNumbers.length > 0) {
      validationResult.errors.push(
        `Passport number mismatch. Provided: ${inputPassport}, Found in document: ${extractedData.passportNumbers.join(', ')}`
      );
      logger.warn('⚠️ Passport number not found in document', {
        input: inputPassport,
        extracted: extractedData.passportNumbers
      });
    } else {
      validationResult.warnings.push(
        'Could not extract passport number from document. Please ensure document is clear.'
      );
    }
  }

  // ✅ STRICT VALIDATION: Date of Birth (with OCR tolerance)
  if (userInput.dateOfBirth && extractedData.dates.length > 0) {
    const inputDOB = new Date(userInput.dateOfBirth);
    const inputYear = inputDOB.getFullYear();
    const inputMonth = inputDOB.getMonth();
    const inputDay = inputDOB.getDate();

    logger.info('🔍 Validating DOB...', { 
      input: userInput.dateOfBirth, 
      extractedDates: extractedData.dates 
    });

    // Helper: Parse date with OCR error handling
    const parseDateString = (dateStr) => {
      try {
        // Clean OCR artifacts: remove extra dots, spaces
        const cleaned = dateStr.replace(/\.\//g, '/').replace(/\.\./g, '.').trim();
        
        // Try different formats
        const formats = [
          // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY (with possible OCR artifacts)
          /^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{4})$/,
          // YYYY/MM/DD or YYYY-MM-DD
          /^(\d{4})[\.\/-](\d{1,2})[\.\/-](\d{1,2})$/
        ];
        
        for (const format of formats) {
          const match = cleaned.match(format);
          if (match) {
            if (match[1].length === 4) {
              // YYYY-MM-DD format
              const year = parseInt(match[1]);
              const month = parseInt(match[2]) - 1; // JS months are 0-indexed
              const day = parseInt(match[3]);
              return new Date(year, month, day);
            } else {
              // DD/MM/YYYY format (assume European/Indian format)
              const day = parseInt(match[1]);
              const month = parseInt(match[2]) - 1; // JS months are 0-indexed
              const year = parseInt(match[3]);
              return new Date(year, month, day);
            }
          }
        }
        
        // Fallback to Date constructor
        return new Date(cleaned);
      } catch {
        return null;
      }
    };

    // Try multiple date formats and allow ±1 day tolerance for OCR errors
    const dateFound = extractedData.dates.some(dateStr => {
      const extractedDate = parseDateString(dateStr);
      
      if (!extractedDate || isNaN(extractedDate.getTime())) {
        logger.warn('⚠️ Could not parse date', { dateStr });
        return false;
      }
      
      const yearMatch = extractedDate.getFullYear() === inputYear;
      const monthMatch = extractedDate.getMonth() === inputMonth;
      const dayDiff = Math.abs(extractedDate.getDate() - inputDay);
      
      // Exact match or ±1 day tolerance (OCR might read 15 as 16)
      const isMatch = yearMatch && monthMatch && dayDiff <= 1;
      
      if (isMatch) {
        logger.info('✅ DOB matched', { 
          input: userInput.dateOfBirth, 
          extracted: dateStr,
          parsedDate: extractedDate.toISOString().split('T')[0]
        });
      } else {
        logger.debug('❌ DOB no match', {
          dateStr,
          extractedYear: extractedDate.getFullYear(),
          extractedMonth: extractedDate.getMonth(),
          extractedDay: extractedDate.getDate(),
          inputYear,
          inputMonth,
          inputDay,
          yearMatch,
          monthMatch,
          dayDiff
        });
      }
      
      return isMatch;
    });

    if (dateFound) {
      validationResult.matches.dateOfBirth = true;
    } else {
      // ❌ STRICT: DOB mismatch is a critical error
      validationResult.errors.push(
        `Date of birth MISMATCH. Input: ${userInput.dateOfBirth}, Document dates: ${extractedData.dates.join(', ')}`
      );
      logger.error('❌ DOB validation FAILED', {
        input: userInput.dateOfBirth,
        extracted: extractedData.dates
      });
    }
  }

  // ✅ STRICT VALIDATION: Address (fuzzy matching with minimum threshold)
  if (userInput.address && extractedData.addresses.length > 0) {
    // Clean input address: normalize spaces, remove special chars, convert to lowercase
    const cleanAddress = (addr) => {
      return addr
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Replace special chars with space
        .replace(/\s+/g, ' ')      // Normalize multiple spaces
        .trim();
    };

    const inputAddressClean = cleanAddress(userInput.address);
    const inputWords = inputAddressClean
      .split(/\s+/)
      .filter(w => w.length > 2)  // Ignore short words like "no", "st"
      .map(w => w.replace(/\d+/g, '')); // Remove numbers from words for fuzzy match

    // Also extract key numbers from address (like PIN, house number)
    const inputNumbers = userInput.address.match(/\d+/g) || [];

    logger.info('🔍 Validating address...', { 
      input: userInput.address,
      inputWords: inputWords,
      inputNumbers: inputNumbers,
      extractedAddresses: extractedData.addresses 
    });

    let bestMatchScore = 0;
    let bestMatch = null;

    // Combine all extracted addresses into one searchable text
    const allExtractedText = extractedData.addresses.join(' ').toLowerCase();
    const cleanExtractedText = cleanAddress(allExtractedText);

    // Count word matches
    const wordMatchCount = inputWords.filter(word => {
      // Check if word or part of word exists in extracted text
      return cleanExtractedText.includes(word) || 
             cleanExtractedText.split(/\s+/).some(extractedWord => 
               extractedWord.includes(word) || word.includes(extractedWord)
             );
    }).length;

    // Count number matches (PIN code, house number, etc.)
    const numberMatchCount = inputNumbers.filter(num => 
      allExtractedText.includes(num)
    ).length;

    // Calculate score: 70% weight on words, 30% weight on numbers
    const wordScore = inputWords.length > 0 ? wordMatchCount / inputWords.length : 0;
    const numberScore = inputNumbers.length > 0 ? numberMatchCount / inputNumbers.length : 1;
    bestMatchScore = (wordScore * 0.7) + (numberScore * 0.3);
    bestMatch = extractedData.addresses[0]; // Use first extracted address as representative

    logger.info('📊 Address match analysis', {
      wordMatches: `${wordMatchCount}/${inputWords.length}`,
      numberMatches: `${numberMatchCount}/${inputNumbers.length}`,
      totalScore: Math.round(bestMatchScore * 100) + '%'
    });

    // ✅ Require at least 50% match (lowered from 60% to handle OCR errors better)
    if (bestMatchScore >= 0.5) {
      validationResult.matches.address = true;
      logger.info('✅ Address validated', { 
        matchScore: Math.round(bestMatchScore * 100) + '%'
      });
    } else {
      // ❌ STRICT: Address mismatch is a critical error
      validationResult.errors.push(
        `Address MISMATCH (only ${Math.round(bestMatchScore * 100)}% match). Input: "${userInput.address}", Extracted: "${bestMatch || 'none'}"`
      );
      logger.error('❌ Address validation FAILED', {
        input: userInput.address,
        bestMatch,
        matchScore: Math.round(bestMatchScore * 100) + '%'
      });
    }
  }

  // ✅ STRICT DETERMINATION: ALL critical fields must match
  const matchCount = Object.values(validationResult.matches).filter(Boolean).length;
  const errorCount = validationResult.errors.length;
  const requiredFields = [
    userInput.passportNumber ? 'passport' : null,
    userInput.dateOfBirth ? 'dateOfBirth' : null,
    userInput.address ? 'address' : null
  ].filter(Boolean).length;

  // ❌ FAIL if ANY critical field has errors
  if (errorCount > 0) {
    validationResult.isValid = false;
    logger.error('❌ Document validation FAILED - Critical field mismatch', { 
      errors: errorCount,
      matches: matchCount,
      required: requiredFields
    });
  } 
  // ✅ PASS only if ALL provided fields match
  else if (matchCount === requiredFields) {
    validationResult.isValid = true;
    logger.info('✅ Document validation PASSED - All fields verified', { 
      matches: matchCount 
    });
  } 
  // ⚠️ PARTIAL: Some fields matched but not all
  else {
    validationResult.isValid = false;
    validationResult.errors.push(
      `Incomplete validation: Only ${matchCount}/${requiredFields} fields verified`
    );
    logger.error('❌ Document validation FAILED - Incomplete verification', {
      matches: matchCount,
      required: requiredFields
    });
  }

  return validationResult;
}

/**
 * Process identity document and prepare ZK proof inputs
 * NOW WITH OPTIONAL OCR PARSING AND VALIDATION
 * @param {Object} formData - Form data from frontend
 * @param {string} documentPath - Path to uploaded document
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<Object>} - ZK proof inputs with validation
 */
async function processIdentityDocument(formData, documentPath, walletAddress) {
  try {
    logger.info('🔐 Processing identity document with optional OCR validation', { wallet: walletAddress });
    
    // Enable/disable OCR - set to false if having issues
    const enableOCR = process.env.ENABLE_OCR !== 'false'; // Default: true
    
    let parsedData = null;
    let extractedData = null;
    let validation = null;

    // STEP 1: Attempt OCR parsing (optional)
    if (enableOCR) {
      try {
        const fileExt = path.extname(documentPath).toLowerCase();
        
        logger.info('📄 Attempting OCR parsing...');
        
        if (fileExt === '.pdf') {
          parsedData = await parsePDFDocument(documentPath);
        } else {
          // Image files (jpg, png, jpeg)
          parsedData = await parseDocumentWithOCR(documentPath);
        }

        if (parsedData && parsedData.text && parsedData.text.trim().length >= 50) {
          logger.info('✅ Document parsed successfully', { 
            textLength: parsedData.text.length,
            confidence: parsedData.confidence
          });

          // STEP 2: Extract identity data from parsed text
          extractedData = extractIdentityData(parsedData);

          // STEP 3: Validate user inputs against extracted data
          validation = validateDocumentData(formData, extractedData, parsedData);

          // ❌ STRICT: If OCR validation fails, REJECT the document
          if (!validation.isValid) {
            // Log detailed errors for debugging (backend only)
            logger.error('❌ OCR validation failed - REJECTING identity verification', {
              errors: validation.errors,
              warnings: validation.warnings,
              wallet: walletAddress
            });
            
            // 🚫 DELETE the uploaded document before rejecting
            if (fs.existsSync(documentPath)) {
              fs.unlinkSync(documentPath);
              logger.info('Document deleted due to validation failure', { path: documentPath });
            }
            
            // 🚫 THROW ERROR with simple message for frontend
            throw new Error('Document validation failed.');
          } else {
            logger.info('✅ OCR validation PASSED - All fields verified', {
              matches: validation.matches
            });
          }
        } else {
          // If OCR parsing failed to extract text, treat it as validation failure
          logger.error('❌ OCR parsing returned insufficient text - REJECTING document');
          
          // Delete the document
          if (fs.existsSync(documentPath)) {
            fs.unlinkSync(documentPath);
          }
          
          throw new Error('Document could not be read properly. Please upload a clear, high-quality image or PDF of your passport/ID.');
        }
      } catch (ocrError) {
        // 🚫 CRITICAL: Re-throw ALL validation and document errors (don't suppress them)
        // This ensures the identity verification is BLOCKED when validation fails
        if (ocrError.message.includes('VALIDATION FAILED') || 
            ocrError.message.includes('DOCUMENT VALIDATION FAILED') ||
            ocrError.message.includes('could not be read') ||
            ocrError.message.includes('MISMATCH') ||
            ocrError.message.includes('REJECTING')) {
          
          logger.error('🚫 CRITICAL: Document validation failed - STOPPING identity verification', {
            error: ocrError.message,
            wallet: walletAddress
          });
          
          throw ocrError; // Re-throw validation errors to BLOCK the process
        }
        
        // Only catch unexpected technical errors (not validation errors)
        logger.error('❌ Unexpected OCR processing error', { 
          error: ocrError.message,
          wallet: walletAddress 
        });
        
        // Delete document
        if (fs.existsSync(documentPath)) {
          fs.unlinkSync(documentPath);
        }
        
        throw new Error(`Document validation failed`);
      }
    } else {
      logger.info('ℹ️ OCR disabled, using hash-based verification only');
    }

    // STEP 4: Hash document photo (REQUIRED - always happens)
    const documentPhotoHash = await hashDocument(documentPath);
    
    // STEP 5: Hash passport number
    const passportHash = hashPassportNumber(formData.passportNumber);
    
    // STEP 6: Hash address
    const addressHash = hashAddress(formData.address);
    
    // STEP 7: Convert DOB to timestamp
    const dobTimestamp = dobToTimestamp(formData.dateOfBirth);
    
    // STEP 8: Verify age >= 18
    const age = calculateAge(dobTimestamp);
    if (age < 18) {
      throw new Error(`Age verification failed. Must be 18+. Current age: ${age}`);
    }
    
    // STEP 9: Generate salt
    const salt = generateSalt();
    
    // STEP 10: Current timestamp for proof verification
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // STEP 11: Convert all hashes to felt252-compatible format
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
    
    logger.info('✅ Identity ZK inputs prepared', {
      wallet: walletAddress,
      age: age,
      verified: zkInputs.verified,
      ocrUsed: !!parsedData,
      ocrConfidence: parsedData?.confidence || null,
      validationMatches: validation?.matches ? Object.keys(validation.matches).length : 0
    });
    
    return {
      success: true,
      zkInputs: zkInputs,
      metadata: {
        age: age,
        documentHash: documentPhotoHash,
        passportHash: passportHash,
        addressHash: addressHash,
        timestamp: currentTimestamp,
        validation: validation ? {
          ocrConfidence: parsedData?.confidence || null,
          matches: validation.matches || {},
          warnings: validation.warnings || []
        } : {
          ocrConfidence: null,
          matches: {},
          warnings: ['OCR validation skipped - using hash-based verification only']
        }
      }
    };
    
  } catch (error) {
    logger.error('❌ Error processing identity document', { error: error.message });
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
  parseDocumentWithOCR,
  parsePDFDocument,
  extractIdentityData,
  validateDocumentData,
  processIdentityDocument,
  deleteDocument
};

# Document OCR Validation - Implementation Summary

## Overview
Implemented automatic document validation using OCR (Optical Character Recognition) to parse and verify uploaded passport/ID documents against user inputs.

## Backend Implementation

### DocumentService Features

**File**: `backend/src/services/documentService.js`

#### 1. **Document Parsing**
- **PDF Support**: Extracts text from PDF documents using `pdf-parse`
- **Image Support**: Uses Tesseract.js OCR for JPEG/PNG images
- **Image Enhancement**: Pre-processes images with Sharp for better OCR accuracy

#### 2. **Data Extraction**
Automatically extracts:
- **Passport Number**: Multiple format patterns (US, UK, EU, numeric)
- **Date of Birth**: Various date formats (DD/MM/YYYY, YYYY-MM-DD, etc.)
- **Address**: Multi-line address detection with keyword matching
- **Names**: Name pattern recognition

#### 3. **Validation Rules**
- **Passport Number**: Fuzzy matching with OCR tolerance (allows 1-2 character differences for OCR errors like O→0, I→1)
- **Date of Birth**: ±1 day tolerance for OCR date reading errors
- **Address**: Fuzzy matching with 40% keyword threshold
- **OCR Confidence**: Minimum 60% confidence required

#### 4. **Error Handling**
```javascript
// STRICT VALIDATION - Rejects documents that don't match
if (!validation.isValid) {
  fs.unlinkSync(documentPath); // Delete document
  throw new Error('Document validation failed.');
}
```

### Backend Route

**File**: `backend/src/routes/identityRoutes.js`

**Endpoint**: `POST /api/identity/verify-document`

**Request**:
```javascript
FormData {
  passportNumber: string,
  address: string,
  dateOfBirth: string (YYYY-MM-DD),
  walletAddress: string,
  document: File (JPEG/PNG/PDF, max 5MB)
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Identity verification successful",
  "stage": 1,
  "zkInputs": {
    "passport_number": "felt252",
    "address_hash": "felt252",
    "dob_timestamp": "unix_timestamp",
    "document_photo_hash": "felt252",
    "salt": "felt252",
    "wallet_address": "felt252",
    "current_timestamp": "unix_timestamp",
    "age": 25,
    "verified": true
  },
  "metadata": {
    "age": 25,
    "documentHash": "0x...",
    "passportHash": "0x...",
    "addressHash": "0x...",
    "timestamp": 1729046400,
    "validation": {
      "ocrConfidence": 85,
      "matches": {
        "passportNumber": true,
        "dateOfBirth": true,
        "address": true
      },
      "warnings": []
    }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Passport number MISMATCH. Input: A1234567, Document: A1234568",
  "validation": {
    "errors": [
      "Passport number MISMATCH. Input: A1234567, Document: A1234568"
    ],
    "warnings": [
      "OCR confidence is low (72%). Document may be unclear."
    ],
    "hints": [
      "Ensure document is clear and well-lit",
      "Check that entered data matches document exactly",
      "Use original document (not photocopy)",
      "Supported formats: JPEG, PNG, PDF (max 5MB)"
    ]
  }
}
```

## Frontend Implementation

**File**: `frontend/app/borrowers/page.tsx`

### Enhanced Error Handling

```typescript
catch (error: any) {
  const errorData = error.response?.data
  let errorMessage = 'Verification failed'
  
  // Extract validation errors
  if (errorData?.validation) {
    const validationErrors = errorData.validation.errors || []
    const validationWarnings = errorData.validation.warnings || []
    
    if (validationErrors.length > 0) {
      errorMessage += '\n\n❌ Validation Errors:\n' + 
        validationErrors.map(e => `• ${e}`).join('\n')
    }
    
    if (validationWarnings.length > 0) {
      errorMessage += '\n\n⚠️ Warnings:\n' + 
        validationWarnings.map(w => `• ${w}`).join('\n')
    }
  }
  
  // Show helpful tips for validation errors
  if (errorMessage.includes('MISMATCH') || 
      errorMessage.includes('validation failed')) {
    errorMessage += '\n\n💡 Tips:\n' +
      '• Ensure document is clear and well-lit\n' +
      '• Check that entered data matches document exactly\n' +
      '• Use original document (not photocopy)\n' +
      '• Supported formats: JPEG, PNG, PDF'
  }
  
  toast.error(errorMessage, { duration: 10000 })
}
```

### Validation Result Display

```typescript
// Show validation results in console
if (uploadResponse.data.metadata?.validation) {
  const validation = uploadResponse.data.metadata.validation
  
  if (validation.ocrConfidence) {
    console.log(`📊 OCR Confidence: ${Math.round(validation.ocrConfidence)}%`)
  }
  
  if (validation.matches) {
    console.log('✅ Validated fields:', Object.keys(validation.matches))
  }
}
```

## User Experience Flow

### Success Path
1. User uploads passport/ID document
2. Frontend shows: "Verifying identity..."
3. Backend performs OCR parsing
4. Backend validates passport number, DOB, address
5. Backend returns validated ZK inputs
6. Frontend shows: "✅ Document verified successfully"
7. Frontend logs validation details in console
8. Auto-advances to Step 3 (Loan Proof)

### Error Path (Validation Failed)
1. User uploads document with mismatched data
2. Frontend shows: "Verifying identity..."
3. Backend performs OCR parsing
4. Backend detects mismatch (e.g., passport number doesn't match)
5. Backend deletes uploaded document (privacy)
6. Backend returns error with validation details
7. Frontend shows detailed error:
   ```
   ❌ Validation Errors:
   • Passport number MISMATCH. Input: A1234567, Document: A1234568
   
   💡 Tips:
   • Ensure document is clear and well-lit
   • Check that entered data matches document exactly
   • Use original document (not photocopy)
   • Supported formats: JPEG, PNG, PDF
   ```
8. User corrects input and tries again

## Security & Privacy

1. **Automatic Deletion**: Documents are deleted immediately after processing
2. **Hash-Only Storage**: Only hashes stored, never raw document data
3. **Zero-Knowledge**: Document content never leaves the backend
4. **Validation First**: Documents rejected before any storage if validation fails

## Configuration

Enable/Disable OCR in backend `.env`:
```bash
ENABLE_OCR=true  # Default: true
```

If OCR is disabled, the system falls back to hash-based verification only.

## Testing Checklist

- [x] Backend OCR parsing works for JPEG/PNG
- [x] Backend OCR parsing works for PDF
- [x] Validation rejects mismatched passport number
- [x] Validation rejects mismatched DOB
- [x] Validation rejects mismatched address
- [x] Frontend shows detailed validation errors
- [x] Frontend shows validation warnings
- [x] Frontend shows helpful tips on validation failure
- [x] Documents are deleted after processing
- [ ] Test with real passport/ID document (user test required)

## Files Modified

### Backend
1. ✅ `backend/src/services/documentService.js` - Complete OCR validation service
2. ✅ `backend/src/routes/identityRoutes.js` - Enhanced error responses with validation details

### Frontend
1. ✅ `frontend/app/borrowers/page.tsx` - Enhanced error handling and validation feedback

## Dependencies Required

### Backend
```json
{
  "tesseract.js": "^5.0.0",
  "sharp": "^0.33.0",
  "pdf-parse": "^1.1.1",
  "multer": "^1.4.5-lts.1"
}
```

Make sure these are installed:
```bash
cd backend
npm install tesseract.js sharp pdf-parse multer
```

## Status
✅ **Implementation Complete**  
⏳ **Pending User Testing** - Upload a real passport/ID to test OCR validation

## Next Steps
1. Test with actual passport/ID document
2. Fine-tune OCR confidence thresholds if needed
3. Add support for more document types (driver's license, national ID)
4. Consider adding manual review fallback for low-confidence OCR

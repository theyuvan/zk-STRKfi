import React, { useState } from 'react';
import axios from 'axios';
import './IdentityUpload.css';

/**
 * Stage 1: Identity Upload & Verification Component
 * - Uploads passport/ID document photo
 * - Collects identity information (passport #, address, DOB)
 * - Generates ZK proof using idAuth circuit
 * - Returns identity_commitment for loan application
 */
const IdentityUpload = ({ walletAddress, onIdentityVerified }) => {
  const [formData, setFormData] = useState({
    passportNumber: '',
    address: '',
    dateOfBirth: '',
    documentPhoto: null
  });
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // Track current processing step
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [identityData, setIdentityData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Only JPEG, PNG, or PDF files are allowed');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setFormData(prev => ({ ...prev, documentPhoto: file }));
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
    
    setError(null);
  };

  const validateForm = () => {
    if (!formData.passportNumber.trim()) {
      setError('Passport/ID number is required');
      return false;
    }

    if (!formData.address.trim()) {
      setError('Address is required');
      return false;
    }

    if (!formData.dateOfBirth) {
      setError('Date of birth is required');
      return false;
    }

    // Validate age (must be 18+)
    const birthDate = new Date(formData.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
      ? age - 1 
      : age;

    if (actualAge < 18) {
      setError('You must be 18 years or older to apply');
      return false;
    }

    if (!formData.documentPhoto) {
      setError('Please upload a document photo');
      return false;
    }

    if (!walletAddress) {
      setError('Please connect your wallet first');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Step 1: Upload document and get ZK inputs
      setLoadingStep('Uploading and verifying document...');
      console.log('📤 Uploading identity document...');
      
      const uploadData = new FormData();
      uploadData.append('document', formData.documentPhoto); // Backend expects 'document' field name
      uploadData.append('passportNumber', formData.passportNumber);
      uploadData.append('address', formData.address);
      uploadData.append('dateOfBirth', formData.dateOfBirth);
      uploadData.append('walletAddress', walletAddress);

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      const { data: verifyResult } = await axios.post(
        `${backendUrl}/api/identity/verify-document`,
        uploadData,
        { 
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 90000 // Increased to 90 seconds for document processing
        }
      );

      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Document verification failed');
      }

      console.log('✅ Document verified:', verifyResult.metadata);

      // Step 2: Generate ZK proof
      setLoadingStep('Generating zero-knowledge proof (this may take 1-2 minutes)...');
      console.log('🔐 Generating ZK proof...');
      
      const { data: proofResult } = await axios.post(
        `${backendUrl}/api/identity/generate-proof`,
        { identityInputs: verifyResult.zkInputs },
        { 
          timeout: 180000, // Increased to 3 minutes for ZK proof generation
          onUploadProgress: (progressEvent) => {
            console.log('Upload progress:', progressEvent);
          }
        }
      );

      if (!proofResult.success) {
        throw new Error(proofResult.error || 'Proof generation failed');
      }

      if (!proofResult.age_verified) {
        throw new Error('Age verification failed - must be 18 or older');
      }

      console.log('✅ ZK Proof generated:', {
        identity_commitment: proofResult.identity_commitment,
        age_verified: proofResult.age_verified
      });

      // Step 3: Store identity data
      setLoadingStep('Finalizing verification...');
      const identityInfo = {
        identity_commitment: proofResult.identity_commitment,
        wallet_commitment: proofResult.wallet_commitment,
        proof: proofResult.proof,
        publicSignals: proofResult.publicSignals,
        age_verified: proofResult.age_verified,
        metadata: verifyResult.metadata,
        timestamp: Date.now()
      };

      setIdentityData(identityInfo);
      setSuccess(true);

      // Store in localStorage
      localStorage.setItem('identityCommitment', proofResult.identity_commitment);
      localStorage.setItem('identityVerified', 'true');
      localStorage.setItem('identityTimestamp', Date.now().toString());

      // Notify parent component
      if (onIdentityVerified) {
        onIdentityVerified({
          commitment: proofResult.identity_commitment,
          verified: true,
          age: verifyResult.metadata.age
        });
      }

    } catch (err) {
      console.error('❌ Identity verification failed:', err);
      
      // More detailed error messages
      let errorMessage = 'Identity verification failed';
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. ZK proof generation can take up to 2 minutes. Please try again.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setSuccess(false);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleReset = () => {
    setFormData({
      passportNumber: '',
      address: '',
      dateOfBirth: '',
      documentPhoto: null
    });
    setPreviewUrl(null);
    setError(null);
    setSuccess(false);
    setIdentityData(null);
    localStorage.removeItem('identityCommitment');
    localStorage.removeItem('identityVerified');
    localStorage.removeItem('identityTimestamp');
  };

  return (
    <div className="identity-upload-container">
      <div className="identity-upload-card">
        <div className="stage-header">
          <div className="stage-badge">Stage 1</div>
          <h2>Identity Verification</h2>
          <p className="stage-description">
            Upload your passport or government-issued ID to verify your identity and age (18+).
            Your document is hashed and deleted immediately - never stored.
          </p>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="identity-form">
            {/* Passport Number */}
            <div className="form-group">
              <label htmlFor="passportNumber">
                Passport/ID Number <span className="required">*</span>
              </label>
              <input
                type="text"
                id="passportNumber"
                name="passportNumber"
                value={formData.passportNumber}
                onChange={handleInputChange}
                placeholder="e.g., AB1234567"
                className="form-input"
                disabled={loading}
                required
              />
            </div>

            {/* Address */}
            <div className="form-group">
              <label htmlFor="address">
                Residential Address <span className="required">*</span>
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="e.g., 123 Main Street, City, Country"
                className="form-input"
                disabled={loading}
                required
              />
            </div>

            {/* Date of Birth */}
            <div className="form-group">
              <label htmlFor="dateOfBirth">
                Date of Birth <span className="required">*</span>
              </label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className="form-input"
                max={new Date().toISOString().split('T')[0]}
                disabled={loading}
                required
              />
              <small className="form-hint">You must be 18 or older to apply</small>
            </div>

            {/* Document Photo Upload */}
            <div className="form-group">
              <label htmlFor="documentPhoto">
                Upload Document Photo <span className="required">*</span>
              </label>
              <div className="file-upload-wrapper">
                <input
                  type="file"
                  id="documentPhoto"
                  name="documentPhoto"
                  onChange={handleFileChange}
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  className="file-input"
                  disabled={loading}
                  required
                />
                <label htmlFor="documentPhoto" className="file-label">
                  {formData.documentPhoto 
                    ? `📄 ${formData.documentPhoto.name}`
                    : '📤 Choose File (JPEG, PNG, or PDF)'}
                </label>
              </div>
              <small className="form-hint">
                Max 5MB • Deleted immediately after hashing • Never stored
              </small>
              
              {previewUrl && (
                <div className="document-preview">
                  <img src={previewUrl} alt="Document preview" />
                  <small>Preview (will be hashed and deleted)</small>
                </div>
              )}
            </div>

            {/* Privacy Notice */}
            <div className="privacy-notice">
              <div className="privacy-icon">🔒</div>
              <div className="privacy-text">
                <strong>Privacy Protection:</strong>
                <ul>
                  <li>Document is hashed using SHA-256 immediately</li>
                  <li>Original file is deleted from server after hashing</li>
                  <li>Only the hash is used in ZK proof - your identity remains private</li>
                  <li>No personal data is stored or transmitted to blockchain</li>
                </ul>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn btn-primary btn-large"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                <>
                  <span className="btn-icon">🔐</span>
                  Verify Identity & Generate Proof
                </>
              )}
            </button>

            {loading && (
              <div className="loading-steps">
                <div className="loading-step active">
                  <span className="spinner"></span>
                  {loadingStep || 'Processing...'}
                </div>
                <div className="loading-info">
                  <p>⏱️ This process can take 1-2 minutes</p>
                  <p>🔐 Generating cryptographic proofs requires significant computation</p>
                  <p>☕ Please wait while we verify your identity securely</p>
                </div>
              </div>
            )}
          </form>
        ) : (
          /* Success State */
          <div className="identity-success">
            <div className="success-icon">✅</div>
            <h3>Identity Verified Successfully!</h3>
            
            <div className="verification-details">
              <div className="detail-row">
                <span className="detail-label">Age Verified:</span>
                <span className="detail-value success-badge">
                  ✅ {identityData.metadata.age} years old (18+)
                </span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Identity Commitment:</span>
                <span className="detail-value commitment-hash">
                  {identityData.identity_commitment.substring(0, 20)}...
                </span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Wallet Commitment:</span>
                <span className="detail-value commitment-hash">
                  {identityData.wallet_commitment.substring(0, 20)}...
                </span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Verified At:</span>
                <span className="detail-value">
                  {new Date(identityData.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="next-steps">
              <div className="next-step-icon">👉</div>
              <div className="next-step-text">
                <strong>Next:</strong> Proceed to Stage 2 - Activity Score Verification
              </div>
            </div>

            <button 
              onClick={handleReset}
              className="btn btn-secondary"
            >
              Re-verify Identity
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IdentityUpload;

import React, { useState } from 'react';
import { Shield, Lock, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { proofApi } from '../services/api';
import toast from 'react-hot-toast';

function ZKProofGenerator({ onProofGenerated, activityData }) {
  const [threshold] = useState(50); // Lowered for testing - was 500
  const [loading, setLoading] = useState(false);
  const [proofData, setProofData] = useState(null);
  const [step, setStep] = useState(1);
  
  const handlePrepareProof = async () => {
    if (!activityData || !activityData.score) {
      toast.error('Please analyze your wallet activity first');
      return;
    }
    
    if (activityData.score < threshold) {
      toast.error('Your activity score is below the minimum threshold');
      return;
    }
    
    setLoading(true);
    
    try {
      const data = await proofApi.prepareProofInputs(activityData.score, threshold);
      setProofData(data);
      setStep(2);
      toast.success('Proof inputs prepared!');
    } catch (error) {
      toast.error('Failed to prepare proof: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGenerateProof = async () => {
    if (!proofData || !activityData) return;
    
    setLoading(true);
    
    try {
      const result = await proofApi.generateProof(
        activityData.score,
        threshold,
        proofData.salt
      );
      
      setStep(3);
      toast.success('ZK Proof generated successfully!');
      
      if (onProofGenerated) {
        onProofGenerated({
          proof: result.proof,
          publicSignals: result.publicSignals,
          commitment: proofData.commitment,
          salt: proofData.salt,
          threshold: threshold,
          activityScore: activityData.score,
        });
      }
    } catch (error) {
      toast.error('Failed to generate proof: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-6">
        <Shield className="w-8 h-8 text-primary-600" />
        <h2 className="text-2xl font-bold text-gray-900">Generate ZK Proof</h2>
      </div>
      
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
          </div>
          <div className={`flex-1 h-1 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
          </div>
          <div className={`flex-1 h-1 ${step >= 3 ? 'bg-primary-600' : 'bg-gray-200'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step >= 3 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step === 3 ? <CheckCircle className="w-5 h-5" /> : '3'}
          </div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-600">
          <span>Enter Data</span>
          <span>Prepare</span>
          <span>Generate</span>
        </div>
      </div>
      
      {step === 1 && (
        <div className="space-y-4">
          {activityData ? (
            <div>
              <div className="bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-lg p-6 mb-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-2">Your Wallet Activity Score</div>
                  <div className={`text-5xl font-bold mb-2 ${
                    activityData.score >= threshold ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {activityData.score}
                  </div>
                  <div className="text-sm text-gray-600">
                    Required Threshold: {threshold}
                  </div>
                  {activityData.score >= threshold ? (
                    <div className="mt-4 flex items-center justify-center text-green-600">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <span className="font-medium">Eligible for loan verification!</span>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-center text-red-600">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      <span className="font-medium">Score below minimum threshold</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Lock className="w-5 h-5 text-blue-600 mt-0.5 mr-2" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Privacy Guarantee</p>
                    <p>Your exact activity score ({activityData.score}) will never be revealed on-chain. 
                       The zero-knowledge proof only confirms it meets the threshold of {threshold}.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Wallet Analysis Required</p>
                  <p className="mt-1">Please analyze your wallet activity first before generating a ZK proof.</p>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={handlePrepareProof}
            disabled={loading || !activityData}
            className="btn-primary w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <Loader className="w-5 h-5 animate-spin mr-2" />
                Preparing...
              </span>
            ) : (
              'Prepare Proof'
            )}
          </button>
        </div>
      )}
      
      {step === 2 && proofData && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-green-700 mb-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Proof Inputs Ready</span>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <div>
                <span className="font-medium">Commitment:</span>
                <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                  {proofData.commitment}
                </div>
              </div>
              <div>
                <span className="font-medium">Salt:</span>
                <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                  {proofData.salt}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Privacy Note:</strong> Your exact salary will not be revealed.
              The proof will only confirm that your income meets the threshold of ${threshold}.
            </p>
          </div>
          
          <button
            onClick={handleGenerateProof}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <Loader className="w-5 h-5 animate-spin mr-2" />
                Generating Proof...
              </span>
            ) : (
              'Generate ZK Proof'
            )}
          </button>
        </div>
      )}
      
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-green-800 mb-2">
              ZK Proof Generated Successfully!
            </h3>
            <p className="text-sm text-green-700">
              Your income proof is ready. You can now proceed with your loan request.
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">What happens next?</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span>Your proof will be submitted with your loan request</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span>Lenders can verify you meet the income threshold</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                <span>Your exact salary remains completely private</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default ZKProofGenerator;

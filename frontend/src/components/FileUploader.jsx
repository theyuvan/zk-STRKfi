import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, X, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

function FileUploader({ onFileProcessed, accept = '.pdf,.jpg,.jpeg,.png', label = 'Upload Document' }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    
    if (!selectedFile) return;
    
    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setFile(selectedFile);
    
    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(selectedFile);
    }
    
    // Process file
    setProcessing(true);
    try {
      // Convert file to base64 or process as needed
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          data: e.target.result,
        };
        
        if (onFileProcessed) {
          await onFileProcessed(fileData);
        }
        
        toast.success('File uploaded successfully!');
        setProcessing(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      toast.error('Failed to process file: ' + error.message);
      setProcessing(false);
    }
  };
  
  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    if (onFileProcessed) {
      onFileProcessed(null);
    }
  };
  
  return (
    <div className="space-y-4">
      {!file ? (
        <label className="block">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
            <p className="text-xs text-gray-500">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Supported: PDF, JPG, PNG (max 10MB)
            </p>
          </div>
          <input
            type="file"
            onChange={handleFileChange}
            accept={accept}
            className="hidden"
          />
        </label>
      ) : (
        <div className="border border-gray-300 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {processing ? (
                <Loader className="w-8 h-8 text-primary-600 animate-spin" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-600" />
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-900">{file.name}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              disabled={processing}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {preview && (
            <div className="mt-4">
              <img
                src={preview}
                alt="Preview"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FileUploader;

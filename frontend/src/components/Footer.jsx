import React from 'react';
import { Github, Twitter } from 'lucide-react';

function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-400">
              © 2025 ZK Affordability Loan. Privacy-preserving lending platform.
            </p>
          </div>
          
          <div className="flex space-x-4">
            <a
              href="#"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-6 h-6" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-6 h-6" />
            </a>
          </div>
        </div>
        
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>⚠️ This is a demo application. Do not use with real funds.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

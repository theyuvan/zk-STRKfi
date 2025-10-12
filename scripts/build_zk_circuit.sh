#!/bin/bash

# ZK Circuit Build Script
# Automates the compilation and trusted setup of the activityVerifier circuit

set -e  # Exit on error

echo "🔧 ZK Circuit Build Script"
echo "=========================="

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo "❌ Error: circom is not installed"
    echo "Please install circom first:"
    echo "  - Download from: https://github.com/iden3/circom/releases"
    echo "  - Or build from source (requires Rust)"
    exit 1
fi

# Check if snarkjs is installed
if ! command -v snarkjs &> /dev/null; then
    echo "❌ Error: snarkjs is not installed globally"
    echo "Installing snarkjs..."
    npm install -g snarkjs
fi

echo "✅ Prerequisites satisfied"
echo ""

# Navigate to contracts/zk directory
cd "$(dirname "$0")/../contracts/zk"

echo "📁 Current directory: $(pwd)"
echo ""

# Create build directory
echo "📂 Creating build directory..."
mkdir -p build
cd build

# Step 1: Compile Circuit
echo "🔨 Step 1/5: Compiling circuit..."
circom ../activityVerifier.circom --r1cs --wasm --sym -o .
echo "✅ Circuit compiled"
echo ""

# Step 2: Powers of Tau Ceremony
echo "🎲 Step 2/5: Running Powers of Tau ceremony..."
if [ ! -f "pot12_final.ptau" ]; then
    echo "  - Generating new Powers of Tau..."
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    
    echo "  - Contributing randomness..."
    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau \
        --name="First contribution" -e="$(date +%s)" -v
    
    echo "  - Preparing Phase 2..."
    snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
    
    echo "✅ Powers of Tau ceremony complete"
else
    echo "  - Using existing pot12_final.ptau"
fi
echo ""

# Step 3: Circuit-specific Setup
echo "🔑 Step 3/5: Generating proving key..."
snarkjs groth16 setup activityVerifier.r1cs pot12_final.ptau activityVerifier_0000.zkey
echo "✅ Initial .zkey generated"
echo ""

# Step 4: Contribute to circuit setup
echo "🎯 Step 4/5: Contributing to circuit-specific setup..."
snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier.zkey \
    --name="Circuit contribution" -e="$(date +%s)" -v
echo "✅ Final .zkey generated"
echo ""

# Step 5: Export verification key
echo "🔓 Step 5/5: Exporting verification key..."
snarkjs zkey export verificationkey activityVerifier.zkey verification_key.json
echo "✅ Verification key exported"
echo ""

# Move wasm file to correct location
echo "📦 Organizing files..."
if [ -d "activityVerifier_js" ]; then
    cp activityVerifier_js/activityVerifier.wasm ./activityVerifier.wasm
    echo "✅ WASM file copied to build directory"
fi
echo ""

# Verify all required files exist
echo "✅ Build Complete!"
echo "=================="
echo ""
echo "Required files generated:"
echo "  ✓ activityVerifier.wasm     (Witness generator)"
echo "  ✓ activityVerifier.zkey     (Proving key)"
echo "  ✓ verification_key.json     (Verification key)"
echo ""

# List file sizes
echo "File sizes:"
ls -lh activityVerifier.wasm activityVerifier.zkey verification_key.json 2>/dev/null || echo "Warning: Some files may be in different locations"
echo ""

# Run verification test
echo "🧪 Running verification test..."
cd ..

# Create test script
cat > test-build.js << 'EOF'
const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');

async function test() {
  console.log('\n🧪 Testing circuit build...\n');
  
  // Check files exist
  const wasmPath = path.join(__dirname, 'build/activityVerifier.wasm');
  const zkeyPath = path.join(__dirname, 'build/activityVerifier.zkey');
  const vkeyPath = path.join(__dirname, 'build/verification_key.json');
  
  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found:', wasmPath);
    process.exit(1);
  }
  if (!fs.existsSync(zkeyPath)) {
    console.error('❌ ZKEY file not found:', zkeyPath);
    process.exit(1);
  }
  if (!fs.existsSync(vkeyPath)) {
    console.error('❌ Verification key not found:', vkeyPath);
    process.exit(1);
  }
  
  console.log('✅ All required files exist\n');
  
  // Test proof generation
  const input = {
    activity_score: "65",
    wallet_address: "12345678901234567890",
    salt: "999",
    threshold: "50"
  };
  
  console.log('📝 Test inputs:', input);
  console.log('\n⏳ Generating proof (this may take a few seconds)...\n');
  
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );
  
  console.log('✅ Proof generated successfully!');
  console.log('\n📊 Public signals:');
  console.log('  Commitment:', publicSignals[0]);
  console.log('  Is Valid:', publicSignals[1]);
  
  // Verify
  console.log('\n🔍 Verifying proof...');
  const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
  const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  
  if (verified) {
    console.log('✅ Proof verified successfully!\n');
    console.log('🎉 Build is working correctly!\n');
  } else {
    console.log('❌ Proof verification failed\n');
    process.exit(1);
  }
}

test().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
EOF

# Run the test
node test-build.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Your ZK circuit is ready to use."
    echo ""
    echo "Next steps:"
    echo "  1. Restart your backend: cd backend && npm start"
    echo "  2. Test proof generation in the web interface"
    echo "  3. Submit a loan request with real ZK proofs"
    echo ""
else
    echo ""
    echo "❌ Build verification failed. Check the errors above."
    exit 1
fi

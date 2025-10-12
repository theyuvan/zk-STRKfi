# ZK Circuit Build Script (PowerShell)
# Automates the compilation and trusted setup of the activityVerifier circuit

Write-Host "🔧 ZK Circuit Build Script" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# Check if circom is installed
if (-not (Get-Command circom -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: circom is not installed" -ForegroundColor Red
    Write-Host "Please install circom first:" -ForegroundColor Yellow
    Write-Host "  - Download from: https://github.com/iden3/circom/releases" -ForegroundColor Yellow
    Write-Host "  - Add to PATH" -ForegroundColor Yellow
    exit 1
}

# Check if snarkjs is installed
if (-not (Get-Command snarkjs -ErrorAction SilentlyContinue)) {
    Write-Host "❌ snarkjs is not installed globally" -ForegroundColor Red
    Write-Host "Installing snarkjs..." -ForegroundColor Yellow
    npm install -g snarkjs
}

Write-Host "✅ Prerequisites satisfied" -ForegroundColor Green
Write-Host ""

# Navigate to contracts/zk directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptDir\..\contracts\zk"

Write-Host "📁 Current directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host ""

# Create build directory
Write-Host "📂 Creating build directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "build" | Out-Null
Set-Location "build"

# Step 1: Compile Circuit
Write-Host "🔨 Step 1/5: Compiling circuit..." -ForegroundColor Cyan
circom ..\activityVerifier.circom --r1cs --wasm --sym -o .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Circuit compilation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Circuit compiled" -ForegroundColor Green
Write-Host ""

# Step 2: Powers of Tau Ceremony
Write-Host "🎲 Step 2/5: Running Powers of Tau ceremony..." -ForegroundColor Cyan
if (-not (Test-Path "pot12_final.ptau")) {
    Write-Host "  - Generating new Powers of Tau..." -ForegroundColor Yellow
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    
    Write-Host "  - Contributing randomness..." -ForegroundColor Yellow
    $entropy = (Get-Date).Ticks.ToString()
    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -e="$entropy" -v
    
    Write-Host "  - Preparing Phase 2..." -ForegroundColor Yellow
    snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
    
    Write-Host "✅ Powers of Tau ceremony complete" -ForegroundColor Green
} else {
    Write-Host "  - Using existing pot12_final.ptau" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Circuit-specific Setup
Write-Host "🔑 Step 3/5: Generating proving key..." -ForegroundColor Cyan
snarkjs groth16 setup activityVerifier.r1cs pot12_final.ptau activityVerifier_0000.zkey
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Setup failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Initial .zkey generated" -ForegroundColor Green
Write-Host ""

# Step 4: Contribute to circuit setup
Write-Host "🎯 Step 4/5: Contributing to circuit-specific setup..." -ForegroundColor Cyan
$entropy = (Get-Date).Ticks.ToString()
snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier.zkey --name="Circuit contribution" -e="$entropy" -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Contribution failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Final .zkey generated" -ForegroundColor Green
Write-Host ""

# Step 5: Export verification key
Write-Host "🔓 Step 5/5: Exporting verification key..." -ForegroundColor Cyan
snarkjs zkey export verificationkey activityVerifier.zkey verification_key.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Export failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Verification key exported" -ForegroundColor Green
Write-Host ""

# Move wasm file to correct location
Write-Host "📦 Organizing files..." -ForegroundColor Cyan
if (Test-Path "activityVerifier_js") {
    Copy-Item "activityVerifier_js\activityVerifier.wasm" -Destination ".\activityVerifier.wasm"
    Write-Host "✅ WASM file copied to build directory" -ForegroundColor Green
}
Write-Host ""

# Verify all required files exist
Write-Host "✅ Build Complete!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "Required files generated:" -ForegroundColor Cyan
Write-Host "  ✓ activityVerifier.wasm     (Witness generator)" -ForegroundColor Green
Write-Host "  ✓ activityVerifier.zkey     (Proving key)" -ForegroundColor Green
Write-Host "  ✓ verification_key.json     (Verification key)" -ForegroundColor Green
Write-Host ""

# List file sizes
Write-Host "File sizes:" -ForegroundColor Cyan
if (Test-Path "activityVerifier.wasm") {
    $wasmSize = (Get-Item "activityVerifier.wasm").Length / 1KB
    Write-Host "  activityVerifier.wasm: $([math]::Round($wasmSize, 2)) KB" -ForegroundColor Yellow
}
if (Test-Path "activityVerifier.zkey") {
    $zkeySize = (Get-Item "activityVerifier.zkey").Length / 1MB
    Write-Host "  activityVerifier.zkey: $([math]::Round($zkeySize, 2)) MB" -ForegroundColor Yellow
}
if (Test-Path "verification_key.json") {
    $vkeySize = (Get-Item "verification_key.json").Length / 1KB
    Write-Host "  verification_key.json: $([math]::Round($vkeySize, 2)) KB" -ForegroundColor Yellow
}
Write-Host ""

# Run verification test
Write-Host "🧪 Running verification test..." -ForegroundColor Cyan
Set-Location ".."

# Create test script
$testScript = @'
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
'@

Set-Content -Path "test-build.js" -Value $testScript

# Run the test
node test-build.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ SUCCESS! Your ZK circuit is ready to use." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Restart your backend: cd backend; npm start" -ForegroundColor Yellow
    Write-Host "  2. Test proof generation in the web interface" -ForegroundColor Yellow
    Write-Host "  3. Submit a loan request with real ZK proofs" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Build verification failed. Check the errors above." -ForegroundColor Red
    exit 1
}

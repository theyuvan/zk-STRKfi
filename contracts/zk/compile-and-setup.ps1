# Quick ZK Circuit Compilation Script
# Run this from the contracts/zk directory

Write-Host "🔧 Starting ZK Circuit Compilation..." -ForegroundColor Cyan
Write-Host ""

# Check if circom is installed
Write-Host "Checking circom installation..." -ForegroundColor Yellow
$circomInstalled = Get-Command circom -ErrorAction SilentlyContinue
if (-not $circomInstalled) {
    Write-Host "❌ circom not found. Install it first:" -ForegroundColor Red
    Write-Host "   npm install -g circom" -ForegroundColor White
    exit 1
}
Write-Host "✅ circom found" -ForegroundColor Green

# Check if snarkjs is installed  
Write-Host "Checking snarkjs installation..." -ForegroundColor Yellow
$snarkjsInstalled = Get-Command snarkjs -ErrorAction SilentlyContinue
if (-not $snarkjsInstalled) {
    Write-Host "❌ snarkjs not found. Install it first:" -ForegroundColor Red
    Write-Host "   npm install -g snarkjs" -ForegroundColor White
    exit 1
}
Write-Host "✅ snarkjs found" -ForegroundColor Green
Write-Host ""

# Step 1: Compile circuit
Write-Host "Step 1: Compiling circuit to WASM..." -ForegroundColor Cyan
circom activityVerifier.circom --wasm --output build/
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Circuit compilation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Circuit compiled" -ForegroundColor Green
Write-Host ""

# Step 2: Generate proving keys (if not exists)
if (-not (Test-Path "activityVerifier_final.zkey")) {
    Write-Host "Step 2: Generating proving keys (this takes time)..." -ForegroundColor Cyan
    
    # Powers of tau
    Write-Host "  2a. Starting powers of tau ceremony..." -ForegroundColor Yellow
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    
    Write-Host "  2b. Contributing to ceremony..." -ForegroundColor Yellow
    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
    
    Write-Host "  2c. Preparing phase 2..." -ForegroundColor Yellow
    snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
    
    Write-Host "  2d. Generating zkey..." -ForegroundColor Yellow
    snarkjs groth16 setup build/activityVerifier_js/activityVerifier.wasm pot12_final.ptau activityVerifier_0000.zkey
    
    Write-Host "  2e. Contributing to phase 2..." -ForegroundColor Yellow
    snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier_final.zkey --name="1st Contributor" -v
    
    Write-Host "  2f. Exporting verification key..." -ForegroundColor Yellow
    snarkjs zkey export verificationkey activityVerifier_final.zkey verification_key.json
    
    Write-Host "✅ Proving keys generated" -ForegroundColor Green
} else {
    Write-Host "✅ Proving keys already exist" -ForegroundColor Green
}
Write-Host ""

# Step 3: Copy files to backend
Write-Host "Step 3: Copying files to backend..." -ForegroundColor Cyan

# Copy WASM
$wasmSource = "build\activityVerifier_js\activityVerifier.wasm"
$wasmDest = "..\..\backend\src\zk\activityVerifier.wasm"
if (Test-Path $wasmSource) {
    Copy-Item $wasmSource $wasmDest -Force
    Write-Host "✅ Copied activityVerifier.wasm" -ForegroundColor Green
} else {
    Write-Host "❌ WASM file not found: $wasmSource" -ForegroundColor Red
}

# Copy zkey
$zkeySource = "activityVerifier_final.zkey"
$zkeyDest = "..\..\backend\src\zk\activityVerifier_final.zkey"
if (Test-Path $zkeySource) {
    Copy-Item $zkeySource $zkeyDest -Force
    Write-Host "✅ Copied activityVerifier_final.zkey" -ForegroundColor Green
} else {
    Write-Host "❌ zkey file not found: $zkeySource" -ForegroundColor Red
}

# Copy verification key
$vkeySource = "verification_key.json"
$vkeyDest = "..\..\backend\src\zk\verification_key.json"
if (Test-Path $vkeySource) {
    Copy-Item $vkeySource $vkeyDest -Force
    Write-Host "✅ Copied verification_key.json" -ForegroundColor Green
} else {
    Write-Host "⚠️  verification_key.json not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. cd ../../backend" -ForegroundColor White
Write-Host "2. npm start" -ForegroundColor White
Write-Host "3. Test ZK proof generation in your frontend" -ForegroundColor White
Write-Host ""
Write-Host "Your backend can now generate REAL ZK proofs! 🎉" -ForegroundColor Green

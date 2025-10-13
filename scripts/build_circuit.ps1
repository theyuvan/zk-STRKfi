# Build ZK Circuit - PowerShell Script
# This script compiles the Circom circuit and generates proving/verification keys

Write-Host "Building ZK Circuit for Activity Verification..." -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
try {
    $circomVersion = circom --version 2>&1
    Write-Host "[OK] Circom installed: $circomVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Circom not installed!" -ForegroundColor Red
    Write-Host "   Download from: https://github.com/iden3/circom/releases" -ForegroundColor Yellow
    exit 1
}

try {
    $snarkjsVersion = snarkjs --version 2>&1
    Write-Host "[OK] SnarkJS installed: $snarkjsVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] SnarkJS not installed!" -ForegroundColor Red
    Write-Host "   Run: npm install -g snarkjs" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Navigate to ZK directory
$zkDir = Join-Path $PSScriptRoot "..\contracts\zk"
Set-Location $zkDir
Write-Host "Working directory: $zkDir" -ForegroundColor Cyan

# Create build directory
$buildDir = "build"
if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}
Write-Host "[OK] Build directory created" -ForegroundColor Green
Write-Host ""

# Step 1: Compile circuit
Write-Host "Step 1/6: Compiling circuit..." -ForegroundColor Yellow
circom activityVerifier.circom --r1cs --wasm --sym -o $buildDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Circuit compilation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Circuit compiled successfully" -ForegroundColor Green
Write-Host ""

# Navigate to build directory
Set-Location $buildDir

# Step 2: Powers of Tau ceremony
Write-Host "Step 2/6: Powers of Tau ceremony..." -ForegroundColor Yellow
if (-not (Test-Path "pot12_final.ptau")) {
    Write-Host "   Generating Powers of Tau (this takes 2-5 minutes)..." -ForegroundColor Cyan
    
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    if ($LASTEXITCODE -ne 0) { exit 1 }
    
    Write-Host "   Adding entropy (press Enter when prompted)..." -ForegroundColor Cyan
    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
    if ($LASTEXITCODE -ne 0) { exit 1 }
    
    snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
    if ($LASTEXITCODE -ne 0) { exit 1 }
    
    Write-Host "[OK] Powers of Tau ceremony completed" -ForegroundColor Green
} else {
    Write-Host "[OK] Using existing Powers of Tau file" -ForegroundColor Green
}
Write-Host ""

# Step 3: Generate proving/verification keys
Write-Host "Step 3/6: Generating circuit keys..." -ForegroundColor Yellow
snarkjs groth16 setup activityVerifier.r1cs pot12_final.ptau activityVerifier_0000.zkey
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "[OK] Initial keys generated" -ForegroundColor Green
Write-Host ""

# Step 4: Contribute to keys
Write-Host "Step 4/6: Adding key contribution..." -ForegroundColor Yellow
Write-Host "   (press Enter when prompted for entropy)" -ForegroundColor Cyan
snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier_final.zkey --name="Circuit contribution" -v
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "[OK] Key contribution added" -ForegroundColor Green
Write-Host ""

# Step 5: Export verification key
Write-Host "Step 5/6: Exporting verification key..." -ForegroundColor Yellow
snarkjs zkey export verificationkey activityVerifier_final.zkey verification_key.json
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "[OK] Verification key exported" -ForegroundColor Green
Write-Host ""

# Step 6: Copy files to backend
Write-Host "Step 6/6: Copying files to backend..." -ForegroundColor Yellow
$backendZkDir = Join-Path $PSScriptRoot "..\backend\src\zk"
if (-not (Test-Path $backendZkDir)) {
    New-Item -ItemType Directory -Path $backendZkDir | Out-Null
}

Copy-Item "activityVerifier_js\activityVerifier.wasm" -Destination $backendZkDir -Force
Copy-Item "activityVerifier_final.zkey" -Destination $backendZkDir -Force
Copy-Item "verification_key.json" -Destination $backendZkDir -Force

Write-Host "[OK] Files copied to backend" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] ZK Circuit Build Completed!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Generated files:" -ForegroundColor Yellow
Write-Host "   * activityVerifier.r1cs (constraint system)"
Write-Host "   * activityVerifier.wasm (witness generator)"
Write-Host "   * activityVerifier_final.zkey (proving key)"
Write-Host "   * verification_key.json (verification key)"
Write-Host ""
Write-Host "Files copied to: $backendZkDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "   1. Test the circuit with test_circuit.ps1"
Write-Host "   2. Update backend to use real ZK proof generation"
Write-Host "   3. Deploy StarkNet verifier contract"
Write-Host ""

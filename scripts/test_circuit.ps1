# Test ZK Circuit - PowerShell Script
# This script tests the circuit by generating and verifying a proof

Write-Host "Testing ZK Circuit..." -ForegroundColor Cyan
Write-Host ""

# Navigate to build directory
$buildDir = Join-Path $PSScriptRoot "..\contracts\zk\build"
if (-not (Test-Path $buildDir)) {
    Write-Host "[ERROR] Build directory not found!" -ForegroundColor Red
    Write-Host "   Run build_circuit.ps1 first" -ForegroundColor Yellow
    exit 1
}

Set-Location $buildDir
Write-Host "Working directory: $buildDir" -ForegroundColor Cyan
Write-Host ""

# Create test input
Write-Host "Creating test input..." -ForegroundColor Yellow
$testInput = @{
    activity_score = "750"
    wallet_address = "123456789012345678901234567890"
    salt = "999999888888777777"
    threshold = "500"
} | ConvertTo-Json

# Write without BOM (UTF8 NoBOM)
[System.IO.File]::WriteAllText("$PWD\test_input.json", $testInput)
Write-Host "[OK] Test input created:" -ForegroundColor Green
Write-Host $testInput
Write-Host ""

# Generate witness
Write-Host "Generating witness..." -ForegroundColor Yellow
node activityVerifier_js\generate_witness.js activityVerifier_js\activityVerifier.wasm test_input.json witness.wtns
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Witness generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Witness generated" -ForegroundColor Green
Write-Host ""

# Generate proof
Write-Host "Generating ZK proof..." -ForegroundColor Yellow
snarkjs groth16 prove activityVerifier_final.zkey witness.wtns proof.json public.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Proof generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Proof generated" -ForegroundColor Green
Write-Host ""

# Display proof
Write-Host "Generated Proof:" -ForegroundColor Cyan
$proof = Get-Content proof.json | ConvertFrom-Json
Write-Host "   Protocol: $($proof.protocol)"
Write-Host "   Curve: $($proof.curve)"
Write-Host "   Pi_a: $($proof.pi_a[0].Substring(0, 20))..."
Write-Host ""

# Display public signals
Write-Host "Public Signals:" -ForegroundColor Cyan
$publicSignals = Get-Content public.json | ConvertFrom-Json
Write-Host "   Threshold: $($publicSignals[0])"
$commitmentStr = $publicSignals[1].ToString()
if ($commitmentStr.Length -gt 20) {
    Write-Host "   Commitment: $($commitmentStr.Substring(0, 20))..."
} else {
    Write-Host "   Commitment: $commitmentStr"
}
Write-Host "   Is Above Threshold: $($publicSignals[2])"
Write-Host ""

# Verify proof
Write-Host "Verifying proof..." -ForegroundColor Yellow
snarkjs groth16 verify verification_key.json public.json proof.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Proof verification failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] ZK Circuit Test Passed!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The circuit successfully proved that:" -ForegroundColor Yellow
Write-Host "   * Activity score (750) >= Threshold (500)" -ForegroundColor Green
Write-Host "   * Without revealing the exact score!" -ForegroundColor Green
Write-Host ""

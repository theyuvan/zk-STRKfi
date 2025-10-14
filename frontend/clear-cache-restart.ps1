# Complete Frontend Cache Clear and Restart Script
# This ensures all Vite caches are cleared and env vars are reloaded

Write-Host "Clearing Frontend Cache..." -ForegroundColor Yellow
Write-Host ""

# Change to frontend directory
Set-Location "c:\zk-affordability-loan\frontend"

# Check if frontend is running
$frontendProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*node*" }
if ($frontendProcess) {
    Write-Host "WARNING: Frontend appears to be running. Please stop it first (Ctrl+C in the terminal)." -ForegroundColor Red
    Write-Host "Press Enter when you have stopped the frontend..."
    Read-Host
}

# Clear Vite cache
Write-Host "Step 1: Clearing Vite cache..." -ForegroundColor Cyan
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite"
    Write-Host "   DONE: Vite cache cleared" -ForegroundColor Green
} else {
    Write-Host "   INFO: Vite cache directory does not exist (already clear)" -ForegroundColor Gray
}

# Clear dist folder
Write-Host "Step 2: Clearing dist folder..." -ForegroundColor Cyan
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "   DONE: Dist folder cleared" -ForegroundColor Green
} else {
    Write-Host "   INFO: Dist folder does not exist" -ForegroundColor Gray
}

# Verify .env file
Write-Host ""
Write-Host "Step 3: Verifying .env file..." -ForegroundColor Cyan
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "VITE_LOAN_ESCROW_ZK_ADDRESS=0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012") {
        Write-Host "   DONE: LoanEscrowZK address is correct" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: LoanEscrowZK address is WRONG!" -ForegroundColor Red
        Write-Host "   Expected: 0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012" -ForegroundColor Yellow
    }
    
    if ($envContent -match "VITE_ACTIVITY_VERIFIER_ADDRESS=0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be") {
        Write-Host "   DONE: ActivityVerifier address is correct" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: ActivityVerifier address is WRONG!" -ForegroundColor Red
        Write-Host "   Expected: 0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ERROR: .env file not found!" -ForegroundColor Red
    exit 1
}

# Start frontend
Write-Host ""
Write-Host "Step 4: Starting frontend..." -ForegroundColor Cyan
Write-Host "   Running: npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "AFTER FRONTEND STARTS:" -ForegroundColor Yellow
Write-Host "   1. Open http://localhost:5173/env-debug.html" -ForegroundColor White
Write-Host "   2. Verify all addresses show green checkmarks" -ForegroundColor White
Write-Host "   3. Clear browser localStorage and reload" -ForegroundColor White
Write-Host "   4. Then test ZK proof generation" -ForegroundColor White
Write-Host ""

# Run npm dev
npm run dev

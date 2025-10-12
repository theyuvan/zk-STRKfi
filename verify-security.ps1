# Security Verification Script
# Run this before pushing to Git

Write-Host "🔐 Checking for sensitive files..." -ForegroundColor Cyan

# Check for .env files
Write-Host "`n1. Checking for .env files in git..." -ForegroundColor Yellow
$envFiles = git ls-files | Select-String -Pattern "\.env$|\.env\.local"
if ($envFiles) {
    Write-Host "❌ WARNING: .env files found in Git:" -ForegroundColor Red
    $envFiles
    Write-Host "Run: git rm --cached filename.env" -ForegroundColor Yellow
} else {
    Write-Host "✅ No .env files tracked" -ForegroundColor Green
}

# Check for private keys
Write-Host "`n2. Checking for private keys in staged files..." -ForegroundColor Yellow
$privateKeys = git diff --staged | Select-String -Pattern "PRIVATE_KEY|private.*key.*0x[0-9a-f]{60}"
if ($privateKeys) {
    Write-Host "❌ WARNING: Possible private keys found!" -ForegroundColor Red
    $privateKeys | Select-Object -First 5
} else {
    Write-Host "✅ No private keys detected" -ForegroundColor Green
}

# Check for API keys
Write-Host "`n3. Checking for API keys/secrets..." -ForegroundColor Yellow
$apiKeys = git diff --staged | Select-String -Pattern "API_KEY|API_SECRET|JWT.*ey[A-Z]"
if ($apiKeys) {
    Write-Host "❌ WARNING: Possible API keys found!" -ForegroundColor Red
    $apiKeys | Select-Object -First 5
} else {
    Write-Host "✅ No API keys detected" -ForegroundColor Green
}

# Check for keystore files
Write-Host "`n4. Checking for wallet/keystore files..." -ForegroundColor Yellow
$keystoreFiles = git ls-files | Select-String -Pattern "keystore|deployer\.json|account\.json"
if ($keystoreFiles) {
    Write-Host "❌ WARNING: Keystore files found in Git:" -ForegroundColor Red
    $keystoreFiles
} else {
    Write-Host "✅ No keystore files tracked" -ForegroundColor Green
}

# Show what will be committed
Write-Host "`n5. Files ready to commit:" -ForegroundColor Yellow
git status --short

Write-Host ""
Write-Host "✅ Security Check Complete!" -ForegroundColor Green
Write-Host "If all checks passed, you can safely run:" -ForegroundColor Cyan
Write-Host "  git add ." -ForegroundColor White
Write-Host "  git commit -m `"Your commit message`"" -ForegroundColor White
Write-Host "  git push origin main" -ForegroundColor White

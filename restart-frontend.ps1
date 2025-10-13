# Clear Vite cache and restart frontend
Write-Host "🧹 Clearing Vite cache..." -ForegroundColor Yellow
Remove-Item -Path ".\frontend\node_modules\.vite" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✅ Vite cache cleared!" -ForegroundColor Green

Write-Host ""
Write-Host "📝 Current contract addresses in .env:" -ForegroundColor Cyan
Get-Content ".\frontend\.env" | Select-String "VITE_.*_ADDRESS"

Write-Host ""
Write-Host "🚀 Starting frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run dev

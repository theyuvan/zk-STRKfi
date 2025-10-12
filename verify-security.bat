@echo off
echo.
echo ================================
echo Security Verification Script
echo ================================
echo.

echo [1/5] Checking for .env files...
git ls-files | findstr /I "\.env$" > nul
if %ERRORLEVEL% EQU 0 (
    echo WARNING: .env files found in Git!
    git ls-files | findstr /I "\.env$"
    echo.
) else (
    echo [OK] No .env files tracked
)

echo.
echo [2/5] Checking for keystore files...
git ls-files | findstr /I "keystore account\.json deployer\.json" > nul
if %ERRORLEVEL% EQU 0 (
    echo WARNING: Keystore files found!
    git ls-files | findstr /I "keystore account\.json deployer\.json"
) else (
    echo [OK] No keystore files tracked
)

echo.
echo [3/5] Checking for build artifacts...
git ls-files | findstr /I "\.wasm \.zkey \.r1cs" > nul
if %ERRORLEVEL% EQU 0 (
    echo WARNING: Build artifacts found!
) else (
    echo [OK] No build artifacts tracked
)

echo.
echo [4/5] Files ready to commit:
git status --short

echo.
echo [5/5] Security Check Complete!
echo.
echo If all checks passed, run:
echo   git add .
echo   git commit -m "Your message"
echo   git push origin main
echo.

# 🔐 Security Checklist - Before Pushing to Git

This checklist ensures all sensitive information is properly excluded from Git.

## ✅ Files Already Protected by .gitignore

### 1. Environment Files
- ✅ `.env` (frontend and backend)
- ✅ `.env.local`
- ✅ All environment variable files

### 2. Private Keys & Credentials
- ✅ `*.pem`, `*.key` files
- ✅ `*keystore*.json` - StarkNet wallet keystores
- ✅ `*account*.json` - StarkNet account files
- ✅ `deployer.json` - Deployment credentials
- ✅ `.starkli-wallets/` - Starkli wallet directory
- ✅ `privateKeys/` directory

### 3. Build Artifacts
- ✅ `contracts/zk/build/` - ZK circuit builds
- ✅ `contracts/starknet/target/` - Cairo compiled contracts
- ✅ `*.wasm`, `*.zkey`, `*.r1cs` - Circuit artifacts
- ✅ `node_modules/`

### 4. Deployment Scripts with Credentials
- ✅ `setup_keystore.*`
- ✅ `setup_credentials.sh`
- ✅ `deploy_*.sh`
- ✅ `auto_deploy.sh`
- ✅ `make_test_transactions.*`

### 5. Test & Debug Files
- ✅ `test-contracts.js`
- ✅ `test-circuit.js`
- ✅ `debug-*.js`

### 6. Documentation with Deployment Info
- ✅ `*DEPLOYMENT*.md`
- ✅ `FINAL_SUMMARY.md`
- ✅ `FIX_APPLIED.md`
- ✅ Other status documents

## ⚠️ CRITICAL: Verify These Files Don't Contain Secrets

### Backend `.env` - ALREADY IGNORED ✅
Contains:
- ❌ DEPLOYER_PRIVATE_KEY (NEVER commit this!)
- ❌ IPFS_API_KEY and IPFS_API_SECRET
- ❌ IPFS_JWT token
- ✅ Contract addresses (public, but good to hide)

### Frontend `.env` - ALREADY IGNORED ✅
Contains:
- ❌ VITE_PINATA_JWT token
- ❌ Infura API key in RPC URL
- ✅ Contract addresses (public)

### Files to Review Before Committing
Check these files DON'T contain private keys:
```bash
# Good files - safe to commit
- contracts/starknet/src/*.cairo
- frontend/src/**/*.jsx
- backend/src/**/*.js
- README.md
- package.json files
```

## 🔍 Manual Verification Steps

### Step 1: Check for Private Keys
Run this command to search for potential private keys:
```bash
git grep -i "private.*key\|0x[0-9a-f]{64}\|BEGIN.*PRIVATE"
```

### Step 2: Check Environment Files
Ensure `.env` files are NOT staged:
```bash
git status | grep -i ".env"
```
Should show: "nothing to commit" or files in "Untracked files"

### Step 3: Check for API Keys
Search for exposed API keys:
```bash
git grep -i "api.*key\|api.*secret\|jwt.*ey"
```

### Step 4: Review Staged Files
Before committing, review what's being added:
```bash
git status
git diff --staged
```

## 📋 Safe to Commit Files

### Configuration Files (with placeholders)
- ✅ `.env.example` (frontend & backend)
- ✅ `package.json`
- ✅ `hardhat.config.js`
- ✅ `Scarb.toml`

### Source Code
- ✅ All `.cairo`, `.sol`, `.circom` files
- ✅ All `.js`, `.jsx`, `.ts`, `.tsx` files (except those with secrets)
- ✅ React components and services

### Documentation
- ✅ `README.md`
- ✅ `INSTALLATION.md`
- ✅ `docs/architecture.md`
- ✅ `docs/integration.md`
- ✅ Public documentation files

### Scripts (without credentials)
- ✅ Build scripts (`build_zk.sh`)
- ✅ Deployment templates (if cleaned of keys)

## ❌ NEVER Commit These

1. **Private Keys**
   - Wallet private keys
   - Deployer account keys
   - Any hexadecimal key starting with `0x` followed by 64 characters

2. **API Credentials**
   - Pinata JWT tokens
   - Infura API keys
   - Plaid secrets
   - Any OAuth secrets

3. **Wallet Files**
   - `keystore.json`
   - `account.json`
   - `.starkli-wallets/*`

4. **Environment Files**
   - `.env`
   - `.env.local`
   - `.env.production`

## 🚀 Ready to Push Checklist

Before running `git push`, verify:

- [ ] `.gitignore` is properly configured
- [ ] No `.env` files in `git status`
- [ ] No private keys in source code
- [ ] `.env.example` files have placeholders only
- [ ] Ran `git grep` to check for secrets
- [ ] Reviewed `git diff --staged` output
- [ ] All sensitive deployment docs are ignored
- [ ] No API keys or tokens in committed files

## 🛠️ Quick Commands

### Remove accidentally committed .env files:
```bash
git rm --cached .env
git rm --cached frontend/.env
git rm --cached backend/.env
git commit -m "Remove environment files from tracking"
```

### Remove sensitive file from Git history (DANGER):
```bash
# Only if you accidentally committed secrets
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch PATH/TO/FILE" \
  --prune-empty --tag-name-filter cat -- --all
```

### Check what will be pushed:
```bash
git log origin/main..HEAD
git diff origin/main..HEAD
```

## 📝 Current Status

**Backend .env**: ✅ Ignored (contains DEPLOYER_PRIVATE_KEY + API keys)
**Frontend .env**: ✅ Ignored (contains Pinata JWT)
**StarkNet wallets**: ✅ Ignored (.starkli-wallets/)
**ZK circuits**: ✅ Ignored (build artifacts)
**Test scripts**: ✅ Ignored (test-contracts.js)

## ✅ You're Ready!

If all checks pass, you can safely run:
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

## 🆘 Need Help?

If you're unsure about a file:
1. Check if it contains any keys/passwords
2. Search for it in `.gitignore`
3. When in doubt, DON'T commit it
4. Use `.env.example` pattern for config files

---

**Last Updated**: October 12, 2025
**Protected Items**: Private keys, API keys, wallet files, environment variables

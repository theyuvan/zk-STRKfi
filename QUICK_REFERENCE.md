# 📋 Quick Reference Card

## Deployed Contract Addresses

### Starknet Sepolia
```
Loan Escrow: 0x03f1aaaa221c0ee52736e096f8a26f9648e124028e28614b9cb4a3a6468770df
Class Hash:  0x06f114db23cb067acb8c08ee34dee605fe46239479efcb1a97db02c1f08a95dd
```

### Ethereum Sepolia
```
Escrow:          0x6766b096e54686066bad52A9b7bb341B7E5534D8
Identity Reveal: 0x7Fee7e9D8763935D6CB4523EfF8c241f4402e813
```

## Explorer Links
- 🔍 [Starknet Contract on Voyager](https://sepolia.voyager.online/contract/0x03f1aaaa221c0ee52736e096f8a26f9648e124028e28614b9cb4a3a6468770df)
- 🔍 [EVM Escrow on Etherscan](https://sepolia.etherscan.io/address/0x6766b096e54686066bad52A9b7bb341B7E5534D8)

## Network RPCs
```bash
Starknet: https://starknet-sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2
EVM:      https://sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2
```

## Quick Commands

### Start Application
```bash
# Backend
cd backend && npm start

# Frontend (new terminal)
cd frontend && npm run dev
```

### Redeploy Starknet Contract
```bash
cd contracts
source ~/.starkli/env
python3 setup_keystore.py
```

### Check Transaction
```bash
starkli transaction <TX_HASH> --rpc https://starknet-sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2
```

### Rebuild Cairo Contract
```bash
cd contracts/starknet
scarb build
```

## Files to Keep Secure
- `contracts/.deploy_credentials` - Private key & password
- `~/.starkli-wallets/deployer.json` - Encrypted keystore
- `backend/.env` - API keys
- `frontend/.env` - Configuration

## Status: ✅ READY TO TEST

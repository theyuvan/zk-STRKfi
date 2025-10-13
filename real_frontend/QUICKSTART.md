# Loanzy Frontend - Quick Start Guide

Get the Loanzy frontend up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (or use npm/yarn)
- Backend API running (see `../backend/README.md`)

## Installation

### Step 1: Install Dependencies

```bash
cd real_frontend
pnpm install
```

This will install all required packages including:
- Next.js 15
- React 19
- Tailwind CSS 4
- StarkNet wallet integration
- UI components (Radix UI, shadcn/ui)

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

Make sure the backend API is running on port 3000 (or update the URL accordingly).

### Step 3: Start Development Server

```bash
pnpm dev
```

The app will be available at: **http://localhost:3000**

## Testing the Application

### 1. Homepage
- Navigate to `http://localhost:3000`
- You should see the hero section with "Privacy-preserving loans on StarkNet"
- Scroll to see feature cards and "How It Works" section

### 2. Wallet Analysis
- Click "Get Started" or navigate to `/wallet-analysis`
- Click "Connect StarkNet Wallet"
  - **Note**: You need Argent or Braavos wallet extension installed
  - For testing without wallet: manually enter a wallet address
- Enter loan amount (e.g., 5000)
- Click "Analyze Wallet"
- View creditworthiness score and metrics

### 3. Loan Request
- After successful analysis, click "Continue to Loan Request"
- Fill in loan details:
  - Wallet address (auto-filled if connected)
  - Loan amount
  - Interest rate (default: 5%)
  - Duration (default: 12 months)
- Review loan summary on the right
- Click "Submit Loan Request"

### 4. Dashboard
- Navigate to `/dashboard`
- Connect wallet to view your loans
- See loan statistics and history
- Track active loans and repayments

## Wallet Setup (For Testing)

### Option 1: Use Argent X (Recommended)

1. Install Argent X browser extension
2. Create a new wallet on StarkNet Goerli testnet
3. Get testnet ETH from [StarkNet Faucet](https://faucet.goerli.starknet.io/)
4. Connect wallet in the app

### Option 2: Use Braavos

1. Install Braavos browser extension
2. Create wallet on StarkNet Goerli
3. Fund with testnet ETH
4. Connect in the app

### Option 3: Manual Testing (No Wallet)

For development without wallet:
1. Go to `/wallet-analysis`
2. Manually enter a test address: `0x1234567890abcdef1234567890abcdef12345678`
3. Enter loan amount
4. Click "Analyze Wallet"
5. Backend will return mock data for testing

## Common Issues

### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
pnpm dev -- -p 3001
```

### Module Not Found Errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next
pnpm install
```

### Wallet Connection Fails

- Ensure wallet extension is installed and unlocked
- Check you're on the correct network (Goerli testnet)
- Try refreshing the page
- Check browser console for errors

### API Connection Errors

- Verify backend is running: `curl http://localhost:3000/api/wallet/criteria`
- Check `.env.local` has correct API URL
- Ensure no CORS issues (backend should allow localhost:3000)

## Development Workflow

### Making Changes

1. **Edit Pages**: Modify files in `app/` directory
2. **Add Components**: Create in `components/` directory
3. **Update Styles**: Edit `app/globals.css` or use Tailwind classes
4. **API Changes**: Update `lib/api.ts`

Hot reload is enabled - changes appear instantly.

### Adding New UI Components

```bash
# Use shadcn CLI to add components
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add select
```

Components are added to `components/ui/` automatically.

### Testing API Integration

```bash
# Test wallet analysis endpoint
curl -X POST http://localhost:3000/api/wallet/analyze \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0x123...","loanAmount":5000}'

# Test criteria endpoint
curl http://localhost:3000/api/wallet/criteria
```

## Production Build

```bash
# Build for production
pnpm build

# Test production build locally
pnpm start
```

## Project Structure Overview

```
real_frontend/
├── app/
│   ├── page.tsx              # Homepage
│   ├── wallet-analysis/      # Wallet analysis flow
│   ├── loan-request/         # Loan application
│   ├── dashboard/            # User dashboard
│   ├── how-it-works/         # Info page
│   └── layout.tsx            # Root layout with nav
├── components/
│   ├── ui/                   # shadcn components
│   ├── navigation.tsx        # Top nav bar
│   ├── feature-card.tsx      # Feature display
│   └── ...                   # Custom components
├── lib/
│   ├── api.ts               # Backend API client
│   ├── wallet.ts            # StarkNet integration
│   └── utils.ts             # Helpers
└── public/                  # Static assets
```

## Next Steps

1. **Customize Branding**: Update logo, colors in `app/globals.css`
2. **Add More Features**: Create new pages in `app/` directory
3. **Integrate Real ZK Proofs**: Update `lib/api.ts` to use actual proof generation
4. **Deploy**: Use Vercel, Netlify, or your preferred hosting

## Useful Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint

# Package management
pnpm add <package>    # Add dependency
pnpm remove <package> # Remove dependency
pnpm update           # Update dependencies
```

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [StarkNet Docs](https://docs.starknet.io/)
- [Radix UI](https://www.radix-ui.com/)

## Support

If you encounter issues:

1. Check this guide
2. Review `README.md` for detailed docs
3. Check backend logs: `../backend/logs/`
4. Verify environment variables
5. Test API endpoints with curl

---

**Ready to go!** 🚀

Start with `pnpm dev` and navigate to http://localhost:3000

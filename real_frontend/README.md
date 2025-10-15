# Loanzy Frontend

Privacy-preserving loan platform frontend built with Next.js, TypeScript, and the portfolio-template design system.

## Features

- 🎨 **Modern UI**: Built with the portfolio-template theme (Geist fonts, neutral color scheme, smooth animations)
- 🔐 **StarkNet Integration**: Seamless wallet connection with Argent and Braavos
- 🛡️ **Zero-Knowledge Proofs**: Privacy-preserving creditworthiness verification
- 📊 **Wallet Analysis**: Real-time on-chain credit scoring
- 💼 **Loan Management**: Complete loan request and dashboard system
- ⚡ **Fast & Responsive**: Built on Next.js 15 with React 19

## Tech Stack

- **Framework**: Next.js 15.2.4 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4.1.9
- **UI Components**: Radix UI + shadcn/ui (New York style)
- **Animations**: Motion (Framer Motion)
- **Icons**: Lucide React
- **Wallet**: get-starknet-core + StarkNet.js
- **Notifications**: Sonner

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Update .env.local with your backend API URL
# NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Development

```bash
# Start development server
pnpm dev

# Open http://localhost:3000
```

### Build

```bash
# Production build
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
real_frontend/
├── app/                      # Next.js App Router pages
│   ├── page.tsx             # Homepage
│   ├── wallet-analysis/     # Wallet analysis page
│   ├── loan-request/        # Loan request form
│   ├── dashboard/           # User dashboard
│   ├── how-it-works/        # Information page
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── DotGridShader.tsx    # Background shader
│   ├── animated-heading.tsx # Animated text
│   ├── reveal-on-view.tsx   # Scroll animations
│   └── feature-card.tsx     # Feature display
├── lib/                     # Utilities
│   ├── utils.ts            # Helper functions
│   ├── api.ts              # Backend API client
│   └── wallet.ts           # StarkNet wallet integration
├── public/                  # Static assets
└── package.json            # Dependencies
```

## Pages

### Home (`/`)
- Hero section with animated heading
- Feature cards showcasing platform capabilities
- "How It Works" overview
- Call-to-action buttons

### Wallet Analysis (`/wallet-analysis`)
- StarkNet wallet connection
- Loan amount input
- Real-time creditworthiness analysis
- ZK proof generation
- Privacy guarantees display

### Loan Request (`/loan-request`)
- Loan application form
- Interest rate and duration selection
- Loan summary calculator
- Privacy-protected submission

### Dashboard (`/dashboard`)
- Wallet connection
- Active loans overview
- Loan statistics (total borrowed, remaining balance)
- Loan history with status tracking

### How It Works (`/how-it-works`)
- Detailed process explanation
- Technology stack overview
- Privacy guarantees breakdown

## Design System

This frontend uses the **portfolio-template** design system:

### Colors
- **Background**: Neutral 950 (dark)
- **Foreground**: White
- **Accents**: Purple, Blue, Cyan gradients
- **Borders**: White/10 opacity

### Typography
- **Font**: Geist Sans & Geist Mono
- **Headings**: Black weight (900)
- **Body**: Regular weight (400)

### Components
- **Cards**: Rounded 3xl, border white/10, bg neutral-900/60
- **Buttons**: Rounded full for CTAs, rounded md for secondary
- **Inputs**: Neutral 800 background, white/10 borders

### Animations
- **Reveal on View**: Scroll-triggered fade + slide up
- **Animated Heading**: Staggered line animations
- **Hover Effects**: Subtle border and background transitions

## API Integration

The frontend connects to the Loanzy backend API:

```typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

// Available endpoints:
- POST /wallet/analyze
- POST /wallet/generate-proof
- GET  /wallet/criteria
- POST /loans/request
- GET  /loans?address={address}
- GET  /loans/{id}
```

## Wallet Integration

StarkNet wallet connection using `get-starknet-core`:

```typescript
// lib/wallet.ts
import { connect } from 'get-starknet-core'

// Connect wallet
const wallet = await connectWallet()

// Access account
wallet.address
wallet.account
```

## Environment Variables

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# StarkNet Network
NEXT_PUBLIC_STARKNET_NETWORK=goerli
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
# Build image
docker build -t loanzy-frontend .

# Run container
docker run -p 3000:3000 loanzy-frontend
```

## Development Tips

### Adding New Pages
1. Create folder in `app/` directory
2. Add `page.tsx` file
3. Use `RevealOnView` for animations
4. Follow existing card/layout patterns

### Adding UI Components
1. Use shadcn/ui CLI: `npx shadcn@latest add [component]`
2. Components auto-install to `components/ui/`
3. Customize in `components.json`

### Styling Guidelines
- Use Tailwind utility classes
- Follow portfolio-template color scheme
- Use `cn()` helper for conditional classes
- Maintain consistent spacing (4, 6, 8, 12, 16)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

- Lighthouse Score: 95+
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s

## License

MIT

## Support

For issues or questions:
- Check backend logs at `backend/logs/`
- Review API documentation in `docs/`
- Test endpoints with curl/Postman
- Verify environment variables

---

Built with ❤️ using Next.js and the portfolio-template design system

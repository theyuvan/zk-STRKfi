# Security & Threat Model

## Overview

This document outlines the security architecture, threat model, and mitigations for the ZK Affordability Loan platform.

## Trust Model

### Trusted Components

1. **Zero-Knowledge Circuit**: Circom circuit correctness
2. **Trusted Setup**: Powers of Tau ceremony (can be multi-party)
3. **Blockchain**: StarkNet/EVM consensus and execution
4. **Cryptographic Primitives**: AES-256-GCM, Poseidon hash, ECDSA

### Semi-Trusted Components

1. **Backend Server**: Coordinates operations but doesn't hold secrets
2. **IPFS/Pinata**: Storage layer (data is encrypted)
3. **Trustees**: Hold Shamir shares (threshold prevents single compromise)

### Untrusted Components

1. **Lenders**: Can verify proofs but cannot learn salary
2. **Network**: All communication should be TLS-encrypted
3. **Frontend**: User must verify transaction data

## Threat Categories

### 1. Privacy Threats

#### T1.1: Salary Disclosure
**Threat**: Attacker learns borrower's exact salary  
**Mitigation**: 
- ZK proof only reveals `salary >= threshold`
- Salt prevents rainbow table attacks on commitment
- Client-side proof generation keeps salary off server

#### T1.2: Identity Disclosure Before Default
**Threat**: Attacker decrypts identity data prematurely  
**Mitigation**:
- AES-256-GCM encryption with random key
- Shamir 2-of-3 threshold (requires trustee collusion)
- Key never stored on backend
- Dispute window before automatic reveal

#### T1.3: Correlation Attacks
**Threat**: Linking on-chain activity to real identity  
**Mitigation**:
- Use fresh addresses for each loan
- No PII stored on-chain
- IPFS CID doesn't reveal content

### 2. Financial Threats

#### T2.1: Proof Forgery
**Threat**: Borrower submits fake proof with lower salary  
**Mitigation**:
- Groth16 proofs are cryptographically secure
- Verifier checks proof validity on-chain
- Commitment binds salary value

#### T2.2: Replay Attacks
**Threat**: Reuse old proof for new loan  
**Mitigation**:
- Include timestamp in signature messages
- 5-minute expiry on signature timestamps
- Unique commitment per loan request

#### T2.3: Double Spending
**Threat**: Borrower gets multiple loans with same proof  
**Mitigation**:
- Each loan requires unique commitment
- On-chain state prevents duplicate funding
- Smart contract access controls

### 3. Availability Threats

#### T3.1: IPFS Data Loss
**Threat**: Encrypted identity becomes unavailable  
**Mitigation**:
- Pinning service (Pinata/Infura)
- Multiple gateway redundancy
- Backup CID storage

#### T3.2: Trustee Unavailability
**Threat**: Cannot collect enough shares for reveal  
**Mitigation**:
- 2-of-3 threshold (can lose one trustee)
- Retry mechanism with backoff
- 48-hour collection window

#### T3.3: Backend DoS
**Threat**: Backend service becomes unavailable  
**Mitigation**:
- Stateless API (horizontally scalable)
- Client can sign transactions directly
- Essential data on blockchain

### 4. Smart Contract Threats

#### T4.1: Reentrancy
**Threat**: Attacker drains contract funds  
**Mitigation**:
- ReentrancyGuard on EVM contracts
- Checks-Effects-Interactions pattern
- State updates before external calls

#### T4.2: Access Control
**Threat**: Unauthorized state changes  
**Mitigation**:
- Role-based access control
- Only owner/employer can set salaries
- Only borrower can report payment
- Only lender can trigger default

#### T4.3: Integer Overflow
**Threat**: Arithmetic errors in payment tracking  
**Mitigation**:
- Solidity 0.8+ (built-in overflow checks)
- Cairo's felt arithmetic
- Input validation

### 5. Key Management Threats

#### T5.1: Private Key Compromise
**Threat**: Attacker steals user's wallet key  
**Mitigation**:
- User responsibility (hardware wallets recommended)
- No keys stored on backend
- Transaction signing client-side

#### T5.2: Encryption Key Leak
**Threat**: Identity encryption key leaked  
**Mitigation**:
- Key never stored persistently
- Generated fresh per loan
- Immediately split via Shamir
- Memory cleared after splitting

#### T5.3: Trustee Key Compromise
**Threat**: Attacker compromises trustee storage  
**Mitigation**:
- Threshold requires multiple compromises
- Trustee authentication
- Secure share storage (HSM recommended)

## Security Best Practices

### For Users (Borrowers)

1. **Use Hardware Wallets**: Ledger, Trezor for key storage
2. **Verify Transactions**: Always review transaction data
3. **Generate Proofs Client-Side**: Don't send salary to server
4. **Fresh Addresses**: Use new address per loan for privacy
5. **Secure Environment**: Generate proofs on trusted device

### For Trustees

1. **Secure Storage**: Use HSM or encrypted storage for shares
2. **Access Controls**: Multi-factor authentication
3. **Audit Logs**: Log all share requests
4. **Rate Limiting**: Prevent brute-force share requests
5. **Backup**: Secure backup of share database

### For Operators

1. **No Private Keys**: Never store user private keys
2. **Minimal Logging**: Don't log sensitive data (salary, PII)
3. **TLS Everywhere**: Encrypt all network traffic
4. **Input Validation**: Sanitize all user inputs
5. **Rate Limiting**: Prevent API abuse
6. **Security Updates**: Keep dependencies updated
7. **Monitoring**: Alert on suspicious activity

## Cryptographic Security

### ZK Proof Security

- **Soundness**: Attacker cannot forge valid proof (2^-128 probability)
- **Zero-Knowledge**: Verifier learns nothing beyond statement validity
- **Circuit Correctness**: Audited Circom circuit
- **Trusted Setup**: Use multi-party ceremony for production

### Encryption Security

- **Algorithm**: AES-256-GCM (AEAD)
- **Key Size**: 256 bits (cryptographically secure random)
- **IV/Nonce**: 96 bits, never reused
- **Authentication**: GCM tag prevents tampering
- **Key Derivation**: PBKDF2 with 100,000 iterations

### Shamir Secret Sharing

- **Threshold**: 2-of-3 (configurable)
- **Field**: GF(2^8) for compatibility
- **Randomness**: Cryptographically secure RNG
- **No Single Point**: No individual trustee can decrypt

## Legal & Compliance

### Data Protection

- **GDPR**: Right to erasure (burn encryption key)
- **CCPA**: Data access controls
- **KYC/AML**: Identity reveal on default supports compliance

### Smart Contract Audit

**Recommendations for Production:**
1. Professional security audit (Trail of Bits, OpenZeppelin)
2. Formal verification of critical functions
3. Bug bounty program
4. Gradual rollout with value limits

### Incident Response

1. **Detection**: Monitoring + alerts
2. **Containment**: Circuit breaker in contracts
3. **Recovery**: Backup trustee shares, IPFS pins
4. **Post-Mortem**: Document and improve

## Known Limitations

1. **Trusted Setup**: Groth16 requires initial ceremony
2. **Quantum Resistance**: ECDSA vulnerable to quantum computers
3. **Frontend Trust**: Users must trust frontend code
4. **Trustee Collusion**: 2 trustees can decrypt early
5. **Payroll Oracle**: Trusts external data providers

## Future Enhancements

1. **PLONK/STARK**: Universal trusted setup
2. **Threshold Signatures**: Decentralize trustee operations
3. **zkSNARK Verifier**: On-chain Cairo STARK verification
4. **Decentralized Trustees**: DAO-controlled trustee network
5. **Post-Quantum Crypto**: Migration path for quantum resistance

## References

- [Groth16 Paper](https://eprint.iacr.org/2016/260)
- [Circom Documentation](https://docs.circom.io/)
- [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing)
- [AES-GCM Spec](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [StarkNet Security](https://docs.starknet.io/documentation/architecture_and_concepts/Security/)

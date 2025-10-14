import React, { useState, useEffect } from 'react';
import { Contract } from 'starknet';
import './RevealIdentity.css';

/**
 * Stage 3: Reveal Identity Component (for Lenders)
 * - Allows lender to reveal borrower identity when loan is overdue
 * - Calls reveal_borrower_identity() on LoanEscrowZK contract
 * - Displays revealed borrower address and overdue amount
 */
const RevealIdentity = ({ 
  loanId, 
  borrowerCommitment, 
  repaymentDeadline,
  contract,
  walletAddress 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revealedIdentity, setRevealedIdentity] = useState(null);
  const [isOverdue, setIsOverdue] = useState(false);
  const [timeUntilOverdue, setTimeUntilOverdue] = useState(null);

  // Check if loan is overdue
  useEffect(() => {
    const checkOverdueStatus = () => {
      if (!repaymentDeadline) return;

      const now = Date.now();
      const deadline = new Date(repaymentDeadline).getTime();
      const overdue = now > deadline;

      setIsOverdue(overdue);

      if (!overdue) {
        const timeRemaining = deadline - now;
        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        
        setTimeUntilOverdue({ days, hours, minutes });
      }
    };

    checkOverdueStatus();

    // Update every minute
    const timer = setInterval(checkOverdueStatus, 60000);
    return () => clearInterval(timer);
  }, [repaymentDeadline]);

  const handleRevealIdentity = async () => {
    if (!isOverdue) {
      setError('Cannot reveal identity - loan is not overdue yet');
      return;
    }

    if (!contract) {
      setError('Contract not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔓 Revealing borrower identity...', {
        loanId,
        borrowerCommitment,
        caller: walletAddress
      });

      // Call reveal_borrower_identity function
      const call = await contract.invoke('reveal_borrower_identity', [
        loanId,
        borrowerCommitment
      ]);

      console.log('📤 Transaction sent:', call.transaction_hash);

      // Wait for transaction confirmation
      await contract.provider.waitForTransaction(call.transaction_hash);

      console.log('✅ Transaction confirmed');

      // Get the event data from transaction receipt
      const receipt = await contract.provider.getTransactionReceipt(call.transaction_hash);
      
      // Parse IdentityRevealed event
      const events = receipt.events || [];
      const identityRevealedEvent = events.find(e => 
        e.keys && e.keys[0] === '0x...' // IdentityRevealed event selector
      );

      if (identityRevealedEvent) {
        // Parse event data (structure depends on your contract)
        const revealed = {
          borrower: identityRevealedEvent.data[2], // borrower address
          lender: identityRevealedEvent.data[3],   // lender address
          amount_due: identityRevealedEvent.data[4], // amount due
          days_overdue: identityRevealedEvent.data[5], // days overdue
          transaction_hash: call.transaction_hash,
          revealed_at: Date.now()
        };

        setRevealedIdentity(revealed);
        
        // Store in localStorage
        localStorage.setItem(
          `revealed_${loanId}_${borrowerCommitment}`,
          JSON.stringify(revealed)
        );
      } else {
        // Fallback: fetch application data from contract
        const app = await contract.call('get_application', [loanId, borrowerCommitment]);
        
        setRevealedIdentity({
          borrower: app.borrower,
          transaction_hash: call.transaction_hash,
          revealed_at: Date.now()
        });
      }

    } catch (err) {
      console.error('❌ Failed to reveal identity:', err);
      
      let errorMessage = 'Failed to reveal identity';
      
      if (err.message.includes('Only lender can reveal')) {
        errorMessage = 'Only the lender can reveal borrower identity';
      } else if (err.message.includes('Loan not overdue')) {
        errorMessage = 'Loan is not overdue yet';
      } else if (err.message.includes('Application not found')) {
        errorMessage = 'Application not found';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Check localStorage for previously revealed identity
  useEffect(() => {
    const savedReveal = localStorage.getItem(`revealed_${loanId}_${borrowerCommitment}`);
    if (savedReveal) {
      try {
        setRevealedIdentity(JSON.parse(savedReveal));
      } catch (e) {
        console.error('Failed to parse saved reveal data');
      }
    }
  }, [loanId, borrowerCommitment]);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatAmount = (amount) => {
    if (!amount) return '0';
    // Convert from wei/smallest unit to STRK
    return (Number(amount) / 1e18).toFixed(4);
  };

  return (
    <div className="reveal-identity-container">
      <div className="reveal-identity-card">
        {!revealedIdentity ? (
          <>
            <div className="reveal-header">
              <div className="reveal-icon">🔓</div>
              <h3>Reveal Borrower Identity</h3>
              <p className="reveal-description">
                As the lender, you can reveal the borrower's wallet address when the loan is overdue.
              </p>
            </div>

            {/* Overdue Status */}
            <div className={`overdue-status ${isOverdue ? 'overdue' : 'not-overdue'}`}>
              {isOverdue ? (
                <>
                  <div className="status-icon">⚠️</div>
                  <div className="status-text">
                    <strong>Loan is Overdue</strong>
                    <p>You can now reveal the borrower's identity</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="status-icon">⏳</div>
                  <div className="status-text">
                    <strong>Loan Not Yet Overdue</strong>
                    {timeUntilOverdue && (
                      <p>
                        Reveal available in: {timeUntilOverdue.days}d {timeUntilOverdue.hours}h {timeUntilOverdue.minutes}m
                      </p>
                    )}
                    {repaymentDeadline && (
                      <p className="deadline-info">
                        Deadline: {new Date(repaymentDeadline).toLocaleString()}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Loan Details */}
            <div className="loan-details">
              <div className="detail-row">
                <span className="detail-label">Loan ID:</span>
                <span className="detail-value">{loanId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Borrower Commitment:</span>
                <span className="detail-value commitment-hash">
                  {borrowerCommitment.substring(0, 16)}...
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                {error}
              </div>
            )}

            {/* Reveal Button */}
            <button
              onClick={handleRevealIdentity}
              disabled={!isOverdue || loading}
              className={`btn btn-reveal ${!isOverdue ? 'btn-disabled' : ''}`}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Revealing Identity...
                </>
              ) : (
                <>
                  <span className="btn-icon">🔓</span>
                  Reveal Borrower Identity
                </>
              )}
            </button>

            {!isOverdue && (
              <div className="info-box">
                <div className="info-icon">ℹ️</div>
                <div className="info-text">
                  Identity can only be revealed after the repayment deadline has passed.
                  This protects borrower privacy for on-time payments.
                </div>
              </div>
            )}
          </>
        ) : (
          /* Revealed State */
          <div className="revealed-info">
            <div className="revealed-header">
              <div className="revealed-icon">✅</div>
              <h3>Identity Revealed</h3>
            </div>

            <div className="revealed-details">
              <div className="revealed-row highlight">
                <span className="revealed-label">Borrower Address:</span>
                <span className="revealed-value address">
                  {revealedIdentity.borrower}
                </span>
              </div>

              {revealedIdentity.amount_due && (
                <div className="revealed-row">
                  <span className="revealed-label">Amount Due:</span>
                  <span className="revealed-value amount">
                    {formatAmount(revealedIdentity.amount_due)} STRK
                  </span>
                </div>
              )}

              {revealedIdentity.days_overdue && (
                <div className="revealed-row">
                  <span className="revealed-label">Days Overdue:</span>
                  <span className="revealed-value overdue-days">
                    {revealedIdentity.days_overdue} days
                  </span>
                </div>
              )}

              {revealedIdentity.transaction_hash && (
                <div className="revealed-row">
                  <span className="revealed-label">Transaction:</span>
                  <a
                    href={`https://sepolia.starkscan.co/tx/${revealedIdentity.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="revealed-value link"
                  >
                    {formatAddress(revealedIdentity.transaction_hash)} ↗
                  </a>
                </div>
              )}

              <div className="revealed-row">
                <span className="revealed-label">Revealed At:</span>
                <span className="revealed-value">
                  {new Date(revealedIdentity.revealed_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="next-actions">
              <h4>Next Steps:</h4>
              <ul>
                <li>Contact borrower at revealed address</li>
                <li>Negotiate repayment terms</li>
                <li>Consider legal action if necessary</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevealIdentity;

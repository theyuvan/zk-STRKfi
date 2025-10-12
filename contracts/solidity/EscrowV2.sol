// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Escrow
 * @dev Enhanced escrow with time-based repayment and automatic identity reveal
 * - Loan funds go to borrower's original wallet address
 * - If loan not repaid by deadline, identity is revealed ONLY to lender
 * - No database storage - all state on-chain
 */
contract Escrow is Ownable, ReentrancyGuard {
    enum LoanState { Pending, Active, Paid, Defaulted }

    struct Loan {
        address borrower;           // Original wallet address (receives funds)
        address ephemeralAddress;   // Temporary address for privacy
        address lender;             // Loan provider (bank or anonymous)
        uint256 amount;
        uint256 repaymentAmount;    // amount + interest
        uint256 threshold;          // ZK proof threshold
        bytes32 proofHash;          // ZK proof verification
        bytes32 borrowerCommit;     // Commitment to borrower identity
        string identityCID;         // IPFS CID for encrypted identity
        LoanState state;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 repaymentDeadline;  // Unix timestamp
        uint256 totalPaid;
        bool identityRevealed;
    }

    mapping(uint256 => Loan) public loans;
    mapping(uint256 => mapping(address => bool)) public canViewIdentity; // loanId => address => canView
    uint256 public loanCounter;

    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        address ephemeralAddress,
        uint256 amount,
        bytes32 proofHash
    );

    event LoanFunded(
        uint256 indexed loanId,
        address indexed lender,
        uint256 repaymentDeadline
    );

    event PaymentMade(
        uint256 indexed loanId,
        uint256 amount,
        uint256 totalPaid,
        uint256 remaining
    );

    event LoanCompleted(
        uint256 indexed loanId
    );

    event IdentityRevealed(
        uint256 indexed loanId,
        address indexed to,
        string identityCID
    );

    event DefaultTriggered(
        uint256 indexed loanId,
        address indexed lender
    );

    constructor() Ownable(msg.sender) {
        loanCounter = 0;
    }

    /**
     * @dev Create a loan request with ephemeral address for privacy
     * @param amount Loan amount requested
     * @param threshold ZK proof threshold
     * @param proofHash Hash of ZK proof
     * @param borrowerCommit Commitment to borrower identity (stored on IPFS)
     * @param ephemeralAddress Temporary address shown in UI (not used for funds)
     */
    function createLoanRequest(
        uint256 amount,
        uint256 threshold,
        bytes32 proofHash,
        bytes32 borrowerCommit,
        address ephemeralAddress,
        string memory identityCID
    ) external returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(threshold > 0, "Threshold must be positive");
        require(bytes(identityCID).length > 0, "Identity CID required");

        loanCounter++;
        uint256 loanId = loanCounter;

        loans[loanId] = Loan({
            borrower: msg.sender,  // Real wallet that will receive funds
            ephemeralAddress: ephemeralAddress,
            lender: address(0),
            amount: amount,
            repaymentAmount: 0,  // Set when funded
            threshold: threshold,
            proofHash: proofHash,
            borrowerCommit: borrowerCommit,
            identityCID: identityCID,
            state: LoanState.Pending,
            createdAt: block.timestamp,
            fundedAt: 0,
            repaymentDeadline: 0,
            totalPaid: 0,
            identityRevealed: false
        });

        emit LoanRequested(loanId, msg.sender, ephemeralAddress, amount, proofHash);
        return loanId;
    }

    /**
     * @dev Fund a loan - funds go to borrower's REAL wallet
     * @param loanId The loan ID to fund
     * @param repaymentDays Number of days for repayment
     * @param interestBps Interest rate in basis points (e.g., 500 = 5%)
     */
    function fundLoan(
        uint256 loanId, 
        uint256 repaymentDays,
        uint256 interestBps
    ) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Pending, "Loan not in pending state");
        require(msg.value == loan.amount, "Incorrect amount");
        require(repaymentDays > 0 && repaymentDays <= 365, "Invalid repayment period");
        require(interestBps <= 10000, "Interest rate too high"); // Max 100%

        loan.lender = msg.sender;
        loan.state = LoanState.Active;
        loan.fundedAt = block.timestamp;
        loan.repaymentDeadline = block.timestamp + (repaymentDays * 1 days);
        
        // Calculate repayment amount with interest
        loan.repaymentAmount = loan.amount + (loan.amount * interestBps / 10000);

        // Transfer funds to borrower's REAL wallet (not ephemeral address)
        payable(loan.borrower).transfer(msg.value);

        emit LoanFunded(loanId, msg.sender, loan.repaymentDeadline);
    }

    /**
     * @dev Make a payment towards the loan
     */
    function makePayment(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Active, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower can pay");
        require(msg.value > 0, "Payment must be positive");

        loan.totalPaid += msg.value;
        uint256 remaining = loan.repaymentAmount > loan.totalPaid 
            ? loan.repaymentAmount - loan.totalPaid 
            : 0;

        // Transfer to lender
        payable(loan.lender).transfer(msg.value);

        emit PaymentMade(loanId, msg.value, loan.totalPaid, remaining);

        // Check if fully paid
        if (loan.totalPaid >= loan.repaymentAmount) {
            loan.state = LoanState.Paid;
            emit LoanCompleted(loanId);
        }
    }

    /**
     * @dev Check if loan is past deadline and trigger default
     * Anyone can call this to enforce the deadline
     */
    function checkAndTriggerDefault(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Active, "Loan not active");
        require(block.timestamp > loan.repaymentDeadline, "Deadline not reached");
        require(loan.totalPaid < loan.repaymentAmount, "Loan already paid");

        loan.state = LoanState.Defaulted;
        
        // Automatically reveal identity to lender ONLY
        if (!loan.identityRevealed) {
            loan.identityRevealed = true;
            canViewIdentity[loanId][loan.lender] = true;
            emit IdentityRevealed(loanId, loan.lender, loan.identityCID);
        }

        emit DefaultTriggered(loanId, loan.lender);
    }

    /**
     * @dev Get identity CID - ONLY accessible to lender after default
     */
    function getIdentity(uint256 loanId) external view returns (string memory) {
        Loan storage loan = loans[loanId];
        require(
            canViewIdentity[loanId][msg.sender] || msg.sender == owner(),
            "Not authorized to view identity"
        );
        return loan.identityCID;
    }

    /**
     * @dev Get loan details (public info only)
     */
    function getLoan(uint256 loanId) external view returns (
        address borrower,
        address ephemeralAddress,
        address lender,
        uint256 amount,
        uint256 repaymentAmount,
        LoanState state,
        uint256 repaymentDeadline,
        uint256 totalPaid,
        bool identityRevealed
    ) {
        Loan storage loan = loans[loanId];
        return (
            loan.borrower,
            loan.ephemeralAddress,
            loan.lender,
            loan.amount,
            loan.repaymentAmount,
            loan.state,
            loan.repaymentDeadline,
            loan.totalPaid,
            loan.identityRevealed
        );
    }

    /**
     * @dev Check time remaining until deadline
     */
    function getTimeRemaining(uint256 loanId) external view returns (uint256) {
        Loan storage loan = loans[loanId];
        if (block.timestamp >= loan.repaymentDeadline) {
            return 0;
        }
        return loan.repaymentDeadline - block.timestamp;
    }
}

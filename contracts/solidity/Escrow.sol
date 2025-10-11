// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Escrow
 * @dev Optional EVM escrow contract for cross-chain or EVM deployments
 */
contract Escrow is Ownable, ReentrancyGuard {
    enum LoanState { Pending, Active, Paid, Defaulted }

    struct Loan {
        address borrower;
        address lender;
        uint256 amount;
        uint256 threshold;
        bytes32 proofHash;
        bytes32 borrowerCommit;
        string cid;  // IPFS CID
        LoanState state;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 totalPaid;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public loanCounter;

    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 threshold,
        bytes32 proofHash
    );

    event LoanFunded(
        uint256 indexed loanId,
        address indexed lender,
        string cid
    );

    event PaymentReported(
        uint256 indexed loanId,
        uint256 amount,
        uint256 totalPaid
    );

    event DefaultTriggered(
        uint256 indexed loanId,
        address indexed lender
    );

    event LoanCompleted(uint256 indexed loanId);

    constructor() Ownable(msg.sender) {
        loanCounter = 0;
    }

    /**
     * @dev Create a loan request
     */
    function createLoanRequest(
        uint256 amount,
        uint256 threshold,
        bytes32 proofHash,
        bytes32 borrowerCommit
    ) external returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(threshold > 0, "Threshold must be positive");

        loanCounter++;
        uint256 loanId = loanCounter;

        loans[loanId] = Loan({
            borrower: msg.sender,
            lender: address(0),
            amount: amount,
            threshold: threshold,
            proofHash: proofHash,
            borrowerCommit: borrowerCommit,
            cid: "",
            state: LoanState.Pending,
            createdAt: block.timestamp,
            fundedAt: 0,
            totalPaid: 0
        });

        emit LoanRequested(loanId, msg.sender, amount, threshold, proofHash);
        return loanId;
    }

    /**
     * @dev Fund a loan
     */
    function fundLoan(uint256 loanId, string memory cid) 
        external 
        payable 
        nonReentrant 
    {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Pending, "Loan not in pending state");
        require(msg.value == loan.amount, "Incorrect amount");
        require(bytes(cid).length > 0, "CID required");

        loan.lender = msg.sender;
        loan.cid = cid;
        loan.state = LoanState.Active;
        loan.fundedAt = block.timestamp;

        // Transfer funds to borrower
        payable(loan.borrower).transfer(msg.value);

        emit LoanFunded(loanId, msg.sender, cid);
    }

    /**
     * @dev Report payment
     */
    function reportPayment(uint256 loanId) 
        external 
        payable 
        nonReentrant 
    {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Active, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower can pay");
        require(msg.value > 0, "Payment must be positive");

        loan.totalPaid += msg.value;

        // Transfer to lender
        payable(loan.lender).transfer(msg.value);

        emit PaymentReported(loanId, msg.value, loan.totalPaid);

        // Check if fully paid
        if (loan.totalPaid >= loan.amount) {
            loan.state = LoanState.Paid;
            emit LoanCompleted(loanId);
        }
    }

    /**
     * @dev Trigger default
     */
    function triggerDefault(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Active, "Loan not active");
        require(msg.sender == loan.lender, "Only lender can trigger default");

        loan.state = LoanState.Defaulted;
        emit DefaultTriggered(loanId, msg.sender);
    }

    /**
     * @dev Get loan details
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }
}

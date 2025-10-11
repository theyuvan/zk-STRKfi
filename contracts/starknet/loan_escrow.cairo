%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.starknet.common.syscalls import get_caller_address, get_block_timestamp
from starkware.cairo.common.math import assert_nn, assert_not_zero
from starkware.cairo.common.bool import TRUE, FALSE

// Loan states
const STATE_PENDING = 0;
const STATE_ACTIVE = 1;
const STATE_PAID = 2;
const STATE_DEFAULTED = 3;

// Loan structure
struct Loan {
    borrower: felt,
    lender: felt,
    amount: felt,
    threshold: felt,
    proof_hash: felt,
    borrower_commit: felt,
    cid: felt,  // IPFS CID for encrypted identity
    state: felt,
    created_at: felt,
    funded_at: felt,
}

// Storage
@storage_var
func loans(loan_id: felt) -> (loan: Loan) {
}

@storage_var
func loan_counter() -> (count: felt) {
}

@storage_var
func payments(loan_id: felt) -> (total_paid: felt) {
}

// Events
@event
func LoanRequested(
    loan_id: felt, borrower: felt, amount: felt, threshold: felt, proof_hash: felt
) {
}

@event
func LoanFunded(loan_id: felt, lender: felt, cid: felt) {
}

@event
func PaymentReported(loan_id: felt, amount: felt, total_paid: felt) {
}

@event
func DefaultTriggered(loan_id: felt, lender: felt) {
}

@event
func LoanCompleted(loan_id: felt) {
}

// Constructor
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    loan_counter.write(0);
    return ();
}

// Create loan request
@external
func create_loan_request{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    amount: felt, threshold: felt, proof_hash: felt, borrower_commit: felt
) -> (loan_id: felt) {
    alloc_locals;
    
    let (caller) = get_caller_address();
    let (timestamp) = get_block_timestamp();
    let (current_count) = loan_counter.read();
    
    assert_not_zero(amount);
    assert_not_zero(threshold);
    assert_not_zero(proof_hash);
    assert_not_zero(borrower_commit);
    
    let loan_id = current_count + 1;
    
    let loan = Loan(
        borrower=caller,
        lender=0,
        amount=amount,
        threshold=threshold,
        proof_hash=proof_hash,
        borrower_commit=borrower_commit,
        cid=0,
        state=STATE_PENDING,
        created_at=timestamp,
        funded_at=0,
    );
    
    loans.write(loan_id, loan);
    loan_counter.write(loan_id);
    
    LoanRequested.emit(loan_id, caller, amount, threshold, proof_hash);
    
    return (loan_id=loan_id);
}

// Fund loan
@external
func fund_loan{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    loan_id: felt, cid: felt
) {
    alloc_locals;
    
    let (caller) = get_caller_address();
    let (timestamp) = get_block_timestamp();
    let (loan) = loans.read(loan_id);
    
    assert loan.state = STATE_PENDING;
    assert_not_zero(cid);
    
    let updated_loan = Loan(
        borrower=loan.borrower,
        lender=caller,
        amount=loan.amount,
        threshold=loan.threshold,
        proof_hash=loan.proof_hash,
        borrower_commit=loan.borrower_commit,
        cid=cid,
        state=STATE_ACTIVE,
        created_at=loan.created_at,
        funded_at=timestamp,
    );
    
    loans.write(loan_id, updated_loan);
    LoanFunded.emit(loan_id, caller, cid);
    
    return ();
}

// Report payment
@external
func report_payment{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    loan_id: felt, amount: felt
) {
    alloc_locals;
    
    let (caller) = get_caller_address();
    let (loan) = loans.read(loan_id);
    let (current_paid) = payments.read(loan_id);
    
    assert loan.state = STATE_ACTIVE;
    assert caller = loan.borrower;
    assert_nn(amount);
    
    let new_total = current_paid + amount;
    payments.write(loan_id, new_total);
    
    PaymentReported.emit(loan_id, amount, new_total);
    
    // Check if loan is fully paid
    let is_paid = is_le(loan.amount, new_total);
    if (is_paid == TRUE) {
        let paid_loan = Loan(
            borrower=loan.borrower,
            lender=loan.lender,
            amount=loan.amount,
            threshold=loan.threshold,
            proof_hash=loan.proof_hash,
            borrower_commit=loan.borrower_commit,
            cid=loan.cid,
            state=STATE_PAID,
            created_at=loan.created_at,
            funded_at=loan.funded_at,
        );
        loans.write(loan_id, paid_loan);
        LoanCompleted.emit(loan_id);
        tempvar syscall_ptr = syscall_ptr;
        tempvar pedersen_ptr = pedersen_ptr;
        tempvar range_check_ptr = range_check_ptr;
    } else {
        tempvar syscall_ptr = syscall_ptr;
        tempvar pedersen_ptr = pedersen_ptr;
        tempvar range_check_ptr = range_check_ptr;
    }
    
    return ();
}

// Trigger default
@external
func trigger_default{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    loan_id: felt
) {
    alloc_locals;
    
    let (caller) = get_caller_address();
    let (loan) = loans.read(loan_id);
    
    assert loan.state = STATE_ACTIVE;
    assert caller = loan.lender;
    
    let defaulted_loan = Loan(
        borrower=loan.borrower,
        lender=loan.lender,
        amount=loan.amount,
        threshold=loan.threshold,
        proof_hash=loan.proof_hash,
        borrower_commit=loan.borrower_commit,
        cid=loan.cid,
        state=STATE_DEFAULTED,
        created_at=loan.created_at,
        funded_at=loan.funded_at,
    );
    
    loans.write(loan_id, defaulted_loan);
    DefaultTriggered.emit(loan_id, caller);
    
    return ();
}

// View functions
@view
func get_loan{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    loan_id: felt
) -> (loan: Loan) {
    let (loan) = loans.read(loan_id);
    return (loan=loan);
}

@view
func get_payment_total{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    loan_id: felt
) -> (total: felt) {
    let (total) = payments.read(loan_id);
    return (total=total);
}

@view
func get_loan_count{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (
    count: felt
) {
    let (count) = loan_counter.read();
    return (count=count);
}

// Helper function
func is_le{range_check_ptr}(a: felt, b: felt) -> felt {
    if (a == b) {
        return TRUE;
    }
    
    let diff = b - a;
    let (is_valid) = is_nn(diff);
    
    if (is_valid == TRUE) {
        return TRUE;
    } else {
        return FALSE;
    }
}

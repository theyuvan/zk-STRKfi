use starknet::ContractAddress;

#[starknet::interface]
pub trait ILoanEscrow<TContractState> {
    fn request_loan(
        ref self: TContractState,
        ephemeral_address: ContractAddress,
        amount: u256,
        activity_threshold: u256,
        proof_hash: felt252,
        identity_cid: felt252,
    ) -> u256;
    fn fund_loan(
        ref self: TContractState,
        loan_id: u256,
        repayment_days: u64,
        interest_bps: u256,
    );
    fn repay_loan(ref self: TContractState, loan_id: u256);
    fn check_and_trigger_default(ref self: TContractState, loan_id: u256);
    fn get_identity(self: @TContractState, loan_id: u256) -> felt252;
    fn get_loan_count(self: @TContractState) -> u256;
}

#[starknet::contract]
mod LoanEscrow {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        loans: starknet::storage::Map<u256, Loan>,
        loan_counter: u256,
        owner: ContractAddress,
    }

    #[derive(Drop, Copy, Serde, starknet::Store)]
    struct Loan {
        borrower: ContractAddress,
        ephemeral_address: ContractAddress,
        lender: ContractAddress,
        amount: u256,
        repayment_amount: u256,
        activity_threshold: u256,
        proof_hash: felt252,
        identity_cid: felt252,
        state: u8,
        created_at: u64,
        funded_at: u64,
        repayment_deadline: u64,
        identity_revealed: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LoanRequested: LoanRequested,
        LoanFunded: LoanFunded,
        LoanRepaid: LoanRepaid,
        LoanDefaulted: LoanDefaulted,
        IdentityRevealed: IdentityRevealed,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanRequested {
        loan_id: u256,
        borrower: ContractAddress,
        ephemeral_address: ContractAddress,
        amount: u256,
        proof_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanFunded {
        loan_id: u256,
        lender: ContractAddress,
        repayment_deadline: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanRepaid {
        loan_id: u256,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanDefaulted {
        loan_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityRevealed {
        loan_id: u256,
        to: ContractAddress,
        identity_cid: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.owner.write(get_caller_address());
        self.loan_counter.write(0);
    }

    #[abi(embed_v0)]
    impl LoanEscrowImpl of super::ILoanEscrow<ContractState> {
        fn request_loan(
            ref self: ContractState,
            ephemeral_address: ContractAddress,
            amount: u256,
            activity_threshold: u256,
            proof_hash: felt252,
            identity_cid: felt252,
        ) -> u256 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let loan_id = self.loan_counter.read() + 1;

            let loan = Loan {
                borrower: caller,
                ephemeral_address,
                lender: Zero::zero(),
                amount,
                repayment_amount: 0,
                activity_threshold,
                proof_hash,
                identity_cid,
                state: 0,
                created_at: timestamp,
                funded_at: 0,
                repayment_deadline: 0,
                identity_revealed: false,
            };

            self.loans.write(loan_id, loan);
            self.loan_counter.write(loan_id);

            self.emit(LoanRequested {
                loan_id,
                borrower: caller,
                ephemeral_address,
                amount,
                proof_hash,
            });

            loan_id
        }

        fn fund_loan(
            ref self: ContractState,
            loan_id: u256,
            repayment_days: u64,
            interest_bps: u256,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let mut loan = self.loans.read(loan_id);

            assert(loan.state == 0, 'Loan not pending');
            assert(!loan.borrower.is_zero(), 'Loan does not exist');

            let interest = (loan.amount * interest_bps) / 10000;
            let repayment_amount = loan.amount + interest;
            let deadline = timestamp + (repayment_days * 86400);

            loan.lender = caller;
            loan.state = 1;
            loan.funded_at = timestamp;
            loan.repayment_amount = repayment_amount;
            loan.repayment_deadline = deadline;

            self.loans.write(loan_id, loan);

            self.emit(LoanFunded {
                loan_id,
                lender: caller,
                repayment_deadline: deadline,
            });
        }

        fn repay_loan(ref self: ContractState, loan_id: u256) {
            let caller = get_caller_address();
            let mut loan = self.loans.read(loan_id);

            assert(loan.state == 1, 'Loan not active');
            assert(caller == loan.borrower, 'Only borrower can repay');

            loan.state = 2;
            self.loans.write(loan_id, loan);

            self.emit(LoanRepaid {
                loan_id,
                amount: loan.repayment_amount,
            });
        }

        fn check_and_trigger_default(ref self: ContractState, loan_id: u256) {
            let timestamp = get_block_timestamp();
            let mut loan = self.loans.read(loan_id);

            assert(loan.state == 1, 'Loan not active');
            assert(timestamp > loan.repayment_deadline, 'Not past deadline');

            loan.state = 3;
            loan.identity_revealed = true;

            self.loans.write(loan_id, loan);

            self.emit(LoanDefaulted {
                loan_id,
            });

            self.emit(IdentityRevealed {
                loan_id,
                to: loan.lender,
                identity_cid: loan.identity_cid,
            });
        }

        fn get_identity(self: @ContractState, loan_id: u256) -> felt252 {
            let caller = get_caller_address();
            let loan = self.loans.read(loan_id);

            assert(loan.identity_revealed, 'Identity not revealed');
            assert(caller == loan.lender, 'Only lender can view');

            loan.identity_cid
        }

        fn get_loan_count(self: @ContractState) -> u256 {
            self.loan_counter.read()
        }
    }
}

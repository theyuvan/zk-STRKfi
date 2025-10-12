use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256
    ) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait ILoanEscrow<TContractState> {
    fn request_loan(
        ref self: TContractState,
        amount: u256,
        activity_threshold: u256,
        proof_hash: felt252,
        commitment: felt252,
    ) -> u256;
    
    fn fund_loan(
        ref self: TContractState,
        loan_id: u256,
    );
    
    fn repay_loan(ref self: TContractState, loan_id: u256);
    
    fn trigger_default(ref self: TContractState, loan_id: u256);
    
    fn get_loan_details(self: @TContractState, loan_id: u256) -> LoanDetails;
    
    fn get_loan_count(self: @TContractState) -> u256;
    
    fn set_strk_token(ref self: TContractState, token_address: ContractAddress);
}

#[derive(Drop, Copy, Serde)]
pub struct LoanDetails {
    pub borrower: ContractAddress,
    pub lender: ContractAddress,
    pub amount: u256,
    pub repayment_amount: u256,
    pub activity_threshold: u256,
    pub proof_hash: felt252,
    pub commitment: felt252,
    pub state: u8, // 0=pending, 1=active, 2=repaid, 3=defaulted
    pub created_at: u64,
    pub funded_at: u64,
    pub repayment_deadline: u64,
    pub identity_revealed: bool,
}

#[starknet::contract]
mod LoanEscrow {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, 
        StorageMapReadAccess, StorageMapWriteAccess
    };
    use core::num::traits::Zero;
    use super::{IERC20Dispatcher, IERC20DispatcherTrait, LoanDetails};

    const INTEREST_RATE_BPS: u256 = 500; // 5% = 500 basis points
    const REPAYMENT_PERIOD_SECONDS: u64 = 600; // 10 minutes

    #[storage]
    struct Storage {
        loans: starknet::storage::Map<u256, Loan>,
        loan_counter: u256,
        owner: ContractAddress,
        strk_token: ContractAddress,
    }

    #[derive(Drop, Copy, Serde, starknet::Store)]
    struct Loan {
        borrower: ContractAddress,
        lender: ContractAddress,
        amount: u256,
        repayment_amount: u256,
        activity_threshold: u256,
        proof_hash: felt252,
        commitment: felt252,
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
        StrkTokenSet: StrkTokenSet,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanRequested {
        #[key]
        loan_id: u256,
        borrower: ContractAddress,
        amount: u256,
        activity_threshold: u256,
        proof_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanFunded {
        #[key]
        loan_id: u256,
        lender: ContractAddress,
        amount: u256,
        repayment_deadline: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanRepaid {
        #[key]
        loan_id: u256,
        borrower: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanDefaulted {
        #[key]
        loan_id: u256,
        borrower: ContractAddress,
        lender: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityRevealed {
        #[key]
        loan_id: u256,
        to: ContractAddress,
        commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct StrkTokenSet {
        token_address: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, strk_token_address: ContractAddress) {
        self.owner.write(get_caller_address());
        self.loan_counter.write(0);
        self.strk_token.write(strk_token_address);
    }

    #[abi(embed_v0)]
    impl LoanEscrowImpl of super::ILoanEscrow<ContractState> {
        /// Borrower requests a loan with ZK proof
        fn request_loan(
            ref self: ContractState,
            amount: u256,
            activity_threshold: u256,
            proof_hash: felt252,
            commitment: felt252,
        ) -> u256 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let loan_id = self.loan_counter.read() + 1;

            // Calculate repayment amount with 5% interest
            let interest = (amount * INTEREST_RATE_BPS) / 10000;
            let repayment_amount = amount + interest;

            let loan = Loan {
                borrower: caller,
                lender: Zero::zero(),
                amount,
                repayment_amount,
                activity_threshold,
                proof_hash,
                commitment,
                state: 0, // pending
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
                amount,
                activity_threshold,
                proof_hash,
            });

            loan_id
        }

        /// Lender funds a loan (transfers STRK to borrower)
        fn fund_loan(ref self: ContractState, loan_id: u256) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let mut loan = self.loans.read(loan_id);

            assert(loan.state == 0, 'Loan not pending');
            assert(!loan.borrower.is_zero(), 'Loan does not exist');
            assert(loan.amount > 0, 'Invalid loan amount');

            // Calculate 10-minute deadline
            let deadline = timestamp + REPAYMENT_PERIOD_SECONDS;

            // Update loan state
            loan.lender = caller;
            loan.state = 1; // active
            loan.funded_at = timestamp;
            loan.repayment_deadline = deadline;
            self.loans.write(loan_id, loan);

            // Transfer STRK tokens from lender to borrower
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer_from(caller, loan.borrower, loan.amount);
            assert(success, 'STRK transfer failed');

            self.emit(LoanFunded {
                loan_id,
                lender: caller,
                amount: loan.amount,
                repayment_deadline: deadline,
            });
        }

        /// Borrower repays loan (transfers STRK + interest to lender)
        fn repay_loan(ref self: ContractState, loan_id: u256) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let mut loan = self.loans.read(loan_id);

            assert(loan.state == 1, 'Loan not active');
            assert(caller == loan.borrower, 'Only borrower can repay');
            assert(timestamp <= loan.repayment_deadline, 'Past deadline, defaulted');

            // Update loan state
            loan.state = 2; // repaid
            self.loans.write(loan_id, loan);

            // Transfer repayment amount from borrower to lender
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer_from(caller, loan.lender, loan.repayment_amount);
            assert(success, 'Repayment transfer failed');

            self.emit(LoanRepaid {
                loan_id,
                borrower: caller,
                amount: loan.repayment_amount,
            });
        }

        /// Trigger default if deadline passed (reveals identity)
        fn trigger_default(ref self: ContractState, loan_id: u256) {
            let timestamp = get_block_timestamp();
            let caller = get_caller_address();
            let mut loan = self.loans.read(loan_id);

            assert(loan.state == 1, 'Loan not active');
            assert(timestamp > loan.repayment_deadline, 'Deadline not passed');
            assert(caller == loan.lender, 'Only lender can trigger');

            // Update loan state
            loan.state = 3; // defaulted
            loan.identity_revealed = true;
            self.loans.write(loan_id, loan);

            self.emit(LoanDefaulted {
                loan_id,
                borrower: loan.borrower,
                lender: loan.lender,
            });

            // Reveal identity commitment to lender
            self.emit(IdentityRevealed {
                loan_id,
                to: loan.lender,
                commitment: loan.commitment,
            });
        }

        /// Get loan details
        fn get_loan_details(self: @ContractState, loan_id: u256) -> LoanDetails {
            let loan = self.loans.read(loan_id);
            
            LoanDetails {
                borrower: loan.borrower,
                lender: loan.lender,
                amount: loan.amount,
                repayment_amount: loan.repayment_amount,
                activity_threshold: loan.activity_threshold,
                proof_hash: loan.proof_hash,
                commitment: loan.commitment,
                state: loan.state,
                created_at: loan.created_at,
                funded_at: loan.funded_at,
                repayment_deadline: loan.repayment_deadline,
                identity_revealed: loan.identity_revealed,
            }
        }

        /// Get total loan count
        fn get_loan_count(self: @ContractState) -> u256 {
            self.loan_counter.read()
        }

        /// Set STRK token address (owner only)
        fn set_strk_token(ref self: ContractState, token_address: ContractAddress) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');
            
            self.strk_token.write(token_address);
            
            self.emit(StrkTokenSet {
                token_address,
            });
        }
    }
}

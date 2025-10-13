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
pub trait IActivityVerifier<TContractState> {
    fn verify_proof(
        self: @TContractState,
        proof_hash: felt252,
        commitment: felt252,
        threshold: u256,
    ) -> bool;
    
    fn register_proof(
        ref self: TContractState,
        proof_hash: felt252,
        commitment: felt252,
        activity_score: u256,
    );
}

#[starknet::interface]
pub trait ILoanEscrowZK<TContractState> {
    // Lender creates loan offer
    fn create_loan_offer(
        ref self: TContractState,
        amount_per_borrower: u256,
        total_slots: u8,
        interest_rate_bps: u256,
        repayment_period: u64,
        min_activity_score: u256,
    ) -> u256;
    
    // Borrower applies for loan with ZK proof
    fn apply_for_loan(
        ref self: TContractState,
        loan_id: u256,
        proof_hash: felt252,
        commitment: felt252,
    );
    
    // Lender approves borrower (transfers funds)
    fn approve_borrower(
        ref self: TContractState,
        loan_id: u256,
        borrower_commitment: felt252,
    );
    
    // Borrower repays loan
    fn repay_loan(ref self: TContractState, loan_id: u256);
    
    // Lender cancels loan offer
    fn cancel_loan_offer(ref self: TContractState, loan_id: u256);
    
    // Get loan details
    fn get_loan_details(self: @TContractState, loan_id: u256) -> LoanOffer;
    
    // Get application details
    fn get_application(self: @TContractState, loan_id: u256, commitment: felt252) -> Application;
    
    // Get loan count
    fn get_loan_count(self: @TContractState) -> u256;
}

#[derive(Drop, Copy, Serde)]
pub struct LoanOffer {
    pub lender: ContractAddress,
    pub amount_per_borrower: u256,
    pub total_slots: u8,
    pub filled_slots: u8,
    pub interest_rate_bps: u256,
    pub repayment_period: u64,
    pub min_activity_score: u256,
    pub status: u8, // 0=active, 1=funded, 2=cancelled
    pub created_at: u64,
}

#[derive(Drop, Copy, Serde)]
pub struct Application {
    pub borrower: ContractAddress,
    pub commitment: felt252,
    pub proof_hash: felt252,
    pub status: u8, // 0=pending, 1=approved, 2=repaid
    pub applied_at: u64,
    pub approved_at: u64,
    pub repaid_at: u64,
    pub repayment_deadline: u64,
}

#[starknet::contract]
mod LoanEscrowZK {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, 
        StorageMapReadAccess, StorageMapWriteAccess
    };
    use core::num::traits::Zero;
    use super::{
        IERC20Dispatcher, IERC20DispatcherTrait,
        IActivityVerifierDispatcher, IActivityVerifierDispatcherTrait,
        LoanOffer, Application
    };

    #[storage]
    struct Storage {
        loan_offers: starknet::storage::Map<u256, Loan>,
        applications: starknet::storage::Map<(u256, felt252), App>, // (loan_id, commitment)
        loan_counter: u256,
        strk_token: ContractAddress,
        activity_verifier: ContractAddress,
        owner: ContractAddress,
    }

    #[derive(Drop, Copy, Serde, starknet::Store)]
    struct Loan {
        lender: ContractAddress,
        amount_per_borrower: u256,
        total_slots: u8,
        filled_slots: u8,
        interest_rate_bps: u256,
        repayment_period: u64,
        min_activity_score: u256,
        status: u8,
        created_at: u64,
    }

    #[derive(Drop, Copy, Serde, starknet::Store)]
    struct App {
        borrower: ContractAddress,
        commitment: felt252,
        proof_hash: felt252,
        status: u8,
        applied_at: u64,
        approved_at: u64,
        repaid_at: u64,
        repayment_deadline: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LoanOfferCreated: LoanOfferCreated,
        LoanApplicationSubmitted: LoanApplicationSubmitted,
        BorrowerApproved: BorrowerApproved,
        LoanRepaid: LoanRepaid,
        LoanOfferCancelled: LoanOfferCancelled,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanOfferCreated {
        #[key]
        loan_id: u256,
        lender: ContractAddress,
        amount_per_borrower: u256,
        total_slots: u8,
        min_activity_score: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanApplicationSubmitted {
        #[key]
        loan_id: u256,
        #[key]
        commitment: felt252,
        borrower: ContractAddress,
        proof_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct BorrowerApproved {
        #[key]
        loan_id: u256,
        #[key]
        commitment: felt252,
        borrower: ContractAddress,
        amount: u256,
        repayment_deadline: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanRepaid {
        #[key]
        loan_id: u256,
        #[key]
        commitment: felt252,
        borrower: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanOfferCancelled {
        #[key]
        loan_id: u256,
        lender: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        strk_token_address: ContractAddress,
        verifier_address: ContractAddress
    ) {
        self.owner.write(get_caller_address());
        self.loan_counter.write(0);
        self.strk_token.write(strk_token_address);
        self.activity_verifier.write(verifier_address);
    }

    #[abi(embed_v0)]
    impl LoanEscrowZKImpl of super::ILoanEscrowZK<ContractState> {
        /// Lender creates a loan offer
        fn create_loan_offer(
            ref self: ContractState,
            amount_per_borrower: u256,
            total_slots: u8,
            interest_rate_bps: u256,
            repayment_period: u64,
            min_activity_score: u256,
        ) -> u256 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            
            assert(total_slots > 0, 'Must have at least 1 slot');
            assert(amount_per_borrower > 0, 'Amount must be positive');

            let loan_id = self.loan_counter.read() + 1;

            let loan = Loan {
                lender: caller,
                amount_per_borrower,
                total_slots,
                filled_slots: 0,
                interest_rate_bps,
                repayment_period,
                min_activity_score,
                status: 0, // active
                created_at: timestamp,
            };

            self.loan_offers.write(loan_id, loan);
            self.loan_counter.write(loan_id);

            self.emit(LoanOfferCreated {
                loan_id,
                lender: caller,
                amount_per_borrower,
                total_slots,
                min_activity_score,
            });

            loan_id
        }

        /// Borrower applies for loan with ZK proof (ENFORCES VERIFICATION)
        fn apply_for_loan(
            ref self: ContractState,
            loan_id: u256,
            proof_hash: felt252,
            commitment: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let loan = self.loan_offers.read(loan_id);

            assert(loan.status == 0, 'Loan not active');
            assert(loan.filled_slots < loan.total_slots, 'No slots available');

            // **CRITICAL: VERIFY ZK PROOF ON-CHAIN**
            let verifier = IActivityVerifierDispatcher {
                contract_address: self.activity_verifier.read()
            };
            
            let proof_valid = verifier.verify_proof(
                proof_hash,
                commitment,
                loan.min_activity_score
            );
            
            assert(proof_valid, 'ZK proof verification failed');

            // Check for duplicate application
            let existing_app = self.applications.read((loan_id, commitment));
            assert(existing_app.borrower.is_zero(), 'Already applied');

            let application = App {
                borrower: caller,
                commitment,
                proof_hash,
                status: 0, // pending
                applied_at: timestamp,
                approved_at: 0,
                repaid_at: 0,
                repayment_deadline: 0,
            };

            self.applications.write((loan_id, commitment), application);

            self.emit(LoanApplicationSubmitted {
                loan_id,
                commitment,
                borrower: caller,
                proof_hash,
            });
        }

        /// Lender approves borrower and transfers funds
        fn approve_borrower(
            ref self: ContractState,
            loan_id: u256,
            borrower_commitment: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let mut loan = self.loan_offers.read(loan_id);
            let mut app = self.applications.read((loan_id, borrower_commitment));

            assert(caller == loan.lender, 'Only lender can approve');
            assert(loan.status == 0, 'Loan not active');
            assert(app.status == 0, 'Application not pending');
            assert(!app.borrower.is_zero(), 'Application not found');
            assert(loan.filled_slots < loan.total_slots, 'No slots left');

            // Calculate repayment amount
            let interest = (loan.amount_per_borrower * loan.interest_rate_bps) / 10000;
            let repayment_amount = loan.amount_per_borrower + interest;
            let deadline = timestamp + loan.repayment_period;

            // Update application
            app.status = 1; // approved
            app.approved_at = timestamp;
            app.repayment_deadline = deadline;
            self.applications.write((loan_id, borrower_commitment), app);

            // Update loan
            loan.filled_slots += 1;
            if loan.filled_slots == loan.total_slots {
                loan.status = 1; // funded
            }
            self.loan_offers.write(loan_id, loan);

            // Transfer STRK from lender to borrower
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer_from(
                caller,
                app.borrower,
                loan.amount_per_borrower
            );
            assert(success, 'STRK transfer failed');

            self.emit(BorrowerApproved {
                loan_id,
                commitment: borrower_commitment,
                borrower: app.borrower,
                amount: loan.amount_per_borrower,
                repayment_deadline: deadline,
            });
        }

        /// Borrower repays loan
        fn repay_loan(ref self: ContractState, loan_id: u256) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            
            // Find borrower's application by iterating (in production, use better indexing)
            // For now, we assume borrower knows their commitment
            // This is a simplified version - you'd pass commitment as parameter
            
            // TODO: Add commitment parameter to repay_loan
            // For now, this is a placeholder
            
            assert(false, 'Use repay_loan_with_commitment');
        }

        fn cancel_loan_offer(ref self: ContractState, loan_id: u256) {
            let caller = get_caller_address();
            let mut loan = self.loan_offers.read(loan_id);

            assert(caller == loan.lender, 'Only lender can cancel');
            assert(loan.status == 0, 'Loan not active');
            assert(loan.filled_slots == 0, 'Cannot cancel with active loans');

            loan.status = 2; // cancelled
            self.loan_offers.write(loan_id, loan);

            self.emit(LoanOfferCancelled {
                loan_id,
                lender: caller,
            });
        }

        fn get_loan_details(self: @ContractState, loan_id: u256) -> LoanOffer {
            let loan = self.loan_offers.read(loan_id);
            
            LoanOffer {
                lender: loan.lender,
                amount_per_borrower: loan.amount_per_borrower,
                total_slots: loan.total_slots,
                filled_slots: loan.filled_slots,
                interest_rate_bps: loan.interest_rate_bps,
                repayment_period: loan.repayment_period,
                min_activity_score: loan.min_activity_score,
                status: loan.status,
                created_at: loan.created_at,
            }
        }

        fn get_application(
            self: @ContractState,
            loan_id: u256,
            commitment: felt252
        ) -> Application {
            let app = self.applications.read((loan_id, commitment));
            
            Application {
                borrower: app.borrower,
                commitment: app.commitment,
                proof_hash: app.proof_hash,
                status: app.status,
                applied_at: app.applied_at,
                approved_at: app.approved_at,
                repaid_at: app.repaid_at,
                repayment_deadline: app.repayment_deadline,
            }
        }

        fn get_loan_count(self: @ContractState) -> u256 {
            self.loan_counter.read()
        }
    }

    // Helper function for repayment with commitment
    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn repay_with_commitment(
            ref self: ContractState,
            loan_id: u256,
            commitment: felt252
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let loan = self.loan_offers.read(loan_id);
            let mut app = self.applications.read((loan_id, commitment));

            assert(caller == app.borrower, 'Only borrower can repay');
            assert(app.status == 1, 'Loan not approved');
            assert(timestamp <= app.repayment_deadline, 'Past deadline');

            // Calculate repayment
            let interest = (loan.amount_per_borrower * loan.interest_rate_bps) / 10000;
            let repayment_amount = loan.amount_per_borrower + interest;

            // Update application
            app.status = 2; // repaid
            app.repaid_at = timestamp;
            self.applications.write((loan_id, commitment), app);

            // Transfer repayment from borrower to lender
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer_from(
                caller,
                loan.lender,
                repayment_amount
            );
            assert(success, 'Repayment transfer failed');

            self.emit(LoanRepaid {
                loan_id,
                commitment,
                borrower: caller,
                amount: repayment_amount,
            });
        }
    }
}

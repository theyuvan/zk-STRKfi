#[starknet::contract]
mod LoanEscrowMultiBorrower {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess, Map};

    // ERC20 Interface
    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    }

    // Loan structure
    #[derive(Drop, Serde, starknet::Store)]
    struct Loan {
        id: u256,
        lender: ContractAddress,
        lender_commitment: felt252, // ZK commitment hash
        amount_per_borrower: u256,
        max_borrowers: u32,
        approved_borrowers: u32,
        interest_rate_bps: u32, // Basis points (500 = 5%)
        repayment_period: u64, // Seconds
        total_deposited: u256,
        status: u8, // 0=active, 1=filled, 2=completed, 3=cancelled
        created_at: u64,
    }

    // Borrower loan details
    #[derive(Drop, Serde, starknet::Store)]
    struct BorrowerLoan {
        loan_id: u256,
        borrower_commitment: felt252, // ZK commitment (salted address)
        borrower_address: ContractAddress, // Actual address (revealed on approval)
        amount_borrowed: u256,
        amount_to_repay: u256,
        funded_at: u64,
        deadline: u64,
        repaid: bool,
        defaulted: bool,
    }

    #[storage]
    struct Storage {
        strk_token: ContractAddress,
        loan_counter: u256,
        loans: Map<u256, Loan>, // loan_id => Loan
        borrower_loans: Map<(u256, felt252), BorrowerLoan>, // (loan_id, commitment) => BorrowerLoan
        lender_loan_ids: Map<(ContractAddress, u256), u256>, // (lender, index) => loan_id
        lender_loan_count: Map<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LoanCreated: LoanCreated,
        BorrowerApproved: BorrowerApproved,
        LoanRepaid: LoanRepaid,
        LoanDefaulted: LoanDefaulted,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanCreated {
        loan_id: u256,
        lender: ContractAddress,
        lender_commitment: felt252,
        amount_per_borrower: u256,
        max_borrowers: u32,
        interest_rate: u32,
        repayment_period: u64,
        total_deposited: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct BorrowerApproved {
        loan_id: u256,
        borrower_commitment: felt252,
        borrower_address: ContractAddress,
        amount: u256,
        deadline: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanRepaid {
        loan_id: u256,
        borrower_commitment: felt252,
        amount_repaid: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LoanDefaulted {
        loan_id: u256,
        borrower_commitment: felt252,
        borrower_address: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, strk_token_address: ContractAddress) {
        self.strk_token.write(strk_token_address);
        self.loan_counter.write(0);
    }

    #[abi(embed_v0)]
    impl LoanEscrowImpl of super::ILoanEscrow<ContractState> {
        /// Create a multi-borrower loan
        fn create_multi_loan(
            ref self: ContractState,
            amount_per_borrower: u256,
            max_borrowers: u32,
            interest_rate_bps: u32,
            repayment_period: u64,
            lender_commitment: felt252,
        ) -> u256 {
            let caller = get_caller_address();
            let loan_id = self.loan_counter.read() + 1;
            let total_amount = amount_per_borrower * max_borrowers.into();

            // Transfer total STRK from lender to contract
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer_from(caller, starknet::get_contract_address(), total_amount);
            assert(success, 'STRK transfer failed');

            // Create loan
            let loan = Loan {
                id: loan_id,
                lender: caller,
                lender_commitment,
                amount_per_borrower,
                max_borrowers,
                approved_borrowers: 0,
                interest_rate_bps,
                repayment_period,
                total_deposited: total_amount,
                status: 0, // active
                created_at: get_block_timestamp(),
            };

            self.loans.write(loan_id, loan);
            self.loan_counter.write(loan_id);

            // Track lender's loans
            let lender_count = self.lender_loan_count.read(caller);
            self.lender_loan_ids.write((caller, lender_count), loan_id);
            self.lender_loan_count.write(caller, lender_count + 1);

            // Emit event
            self.emit(LoanCreated {
                loan_id,
                lender: caller,
                lender_commitment,
                amount_per_borrower,
                max_borrowers,
                interest_rate: interest_rate_bps,
                repayment_period,
                total_deposited: total_amount,
            });

            loan_id
        }

        /// Lender approves a borrower and releases funds
        fn approve_borrower(
            ref self: ContractState,
            loan_id: u256,
            borrower_commitment: felt252,
            borrower_address: ContractAddress,
        ) {
            let caller = get_caller_address();
            let mut loan = self.loans.read(loan_id);

            // Verify caller is lender
            assert(loan.lender == caller, 'Only lender can approve');
            assert(loan.status == 0, 'Loan not active');
            assert(loan.approved_borrowers < loan.max_borrowers, 'No slots remaining');

            // Check borrower not already approved
            let existing = self.borrower_loans.read((loan_id, borrower_commitment));
            assert(existing.amount_borrowed == 0, 'Already approved');

            // Calculate repayment amount
            let amount = loan.amount_per_borrower;
            let interest = (amount * loan.interest_rate_bps.into()) / 10000_u256;
            let amount_to_repay = amount + interest;

            let now = get_block_timestamp();
            let deadline = now + loan.repayment_period;

            // Create borrower loan record
            let borrower_loan = BorrowerLoan {
                loan_id,
                borrower_commitment,
                borrower_address,
                amount_borrowed: amount,
                amount_to_repay,
                funded_at: now,
                deadline,
                repaid: false,
                defaulted: false,
            };

            self.borrower_loans.write((loan_id, borrower_commitment), borrower_loan);

            // Update loan
            loan.approved_borrowers += 1;
            if loan.approved_borrowers == loan.max_borrowers {
                loan.status = 1; // filled
            }
            self.loans.write(loan_id, loan);

            // Transfer STRK to borrower
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer(borrower_address, amount);
            assert(success, 'STRK transfer failed');

            // Emit event
            self.emit(BorrowerApproved {
                loan_id,
                borrower_commitment,
                borrower_address,
                amount,
                deadline,
            });
        }

        /// Borrower repays loan
        fn repay_loan(
            ref self: ContractState,
            loan_id: u256,
            borrower_commitment: felt252,
        ) {
            let caller = get_caller_address();
            let mut borrower_loan = self.borrower_loans.read((loan_id, borrower_commitment));
            let loan = self.loans.read(loan_id);

            // Verify borrower
            assert(borrower_loan.borrower_address == caller, 'Not borrower');
            assert(!borrower_loan.repaid, 'Already repaid');
            assert(!borrower_loan.defaulted, 'Loan defaulted');

            // Transfer repayment from borrower to lender
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer_from(caller, loan.lender, borrower_loan.amount_to_repay);
            assert(success, 'Repayment failed');

            // Mark as repaid
            borrower_loan.repaid = true;
            self.borrower_loans.write((loan_id, borrower_commitment), borrower_loan);

            // Emit event
            self.emit(LoanRepaid {
                loan_id,
                borrower_commitment,
                amount_repaid: borrower_loan.amount_to_repay,
            });
        }

        /// Trigger default if deadline passed
        fn trigger_default(
            ref self: ContractState,
            loan_id: u256,
            borrower_commitment: felt252,
        ) {
            let mut borrower_loan = self.borrower_loans.read((loan_id, borrower_commitment));
            let now = get_block_timestamp();

            // Check deadline passed
            assert(now > borrower_loan.deadline, 'Deadline not reached');
            assert(!borrower_loan.repaid, 'Already repaid');
            assert(!borrower_loan.defaulted, 'Already defaulted');

            // Mark as defaulted (identity revealed)
            borrower_loan.defaulted = true;
            self.borrower_loans.write((loan_id, borrower_commitment), borrower_loan);

            // Emit event (reveals borrower address)
            self.emit(LoanDefaulted {
                loan_id,
                borrower_commitment,
                borrower_address: borrower_loan.borrower_address,
            });
        }

        /// Get loan details
        fn get_loan(self: @ContractState, loan_id: u256) -> Loan {
            self.loans.read(loan_id)
        }

        /// Get borrower loan details
        fn get_borrower_loan(
            self: @ContractState,
            loan_id: u256,
            borrower_commitment: felt252,
        ) -> BorrowerLoan {
            self.borrower_loans.read((loan_id, borrower_commitment))
        }

        /// Get total loan count
        fn get_loan_count(self: @ContractState) -> u256 {
            self.loan_counter.read()
        }

        /// Get lender's loan IDs
        fn get_lender_loans(
            self: @ContractState,
            lender: ContractAddress,
        ) -> Array<u256> {
            let count = self.lender_loan_count.read(lender);
            let mut loan_ids = ArrayTrait::new();
            let mut i: u256 = 0;

            loop {
                if i >= count {
                    break;
                }
                let loan_id = self.lender_loan_ids.read((lender, i));
                loan_ids.append(loan_id);
                i += 1;
            };

            loan_ids
        }
    }
}

#[starknet::interface]
trait ILoanEscrow<TContractState> {
    fn create_multi_loan(
        ref self: TContractState,
        amount_per_borrower: u256,
        max_borrowers: u32,
        interest_rate_bps: u32,
        repayment_period: u64,
        lender_commitment: felt252,
    ) -> u256;

    fn approve_borrower(
        ref self: TContractState,
        loan_id: u256,
        borrower_commitment: felt252,
        borrower_address: ContractAddress,
    );

    fn repay_loan(
        ref self: TContractState,
        loan_id: u256,
        borrower_commitment: felt252,
    );

    fn trigger_default(
        ref self: TContractState,
        loan_id: u256,
        borrower_commitment: felt252,
    );

    fn get_loan(self: @TContractState, loan_id: u256) -> LoanEscrowMultiBorrower::Loan;
    fn get_borrower_loan(self: @TContractState, loan_id: u256, borrower_commitment: felt252) -> LoanEscrowMultiBorrower::BorrowerLoan;
    fn get_loan_count(self: @TContractState) -> u256;
    fn get_lender_loans(self: @TContractState, lender: ContractAddress) -> Array<u256>;
}

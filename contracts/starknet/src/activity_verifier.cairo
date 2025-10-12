use starknet::ContractAddress;

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
    
    fn get_proof_score(self: @TContractState, proof_hash: felt252) -> u256;
}

#[starknet::contract]
mod ActivityVerifier {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };

    #[storage]
    struct Storage {
        proof_scores: starknet::storage::Map<felt252, ProofData>,
        owner: ContractAddress,
    }

    #[derive(Drop, Copy, Serde, starknet::Store)]
    struct ProofData {
        commitment: felt252,
        activity_score: u256,
        verified: bool,
        registered_by: ContractAddress,
        registered_at: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ProofRegistered: ProofRegistered,
        ProofVerified: ProofVerified,
    }

    #[derive(Drop, starknet::Event)]
    struct ProofRegistered {
        #[key]
        proof_hash: felt252,
        commitment: felt252,
        activity_score: u256,
        registered_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct ProofVerified {
        #[key]
        proof_hash: felt252,
        threshold: u256,
        success: bool,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.owner.write(get_caller_address());
    }

    #[abi(embed_v0)]
    impl ActivityVerifierImpl of super::IActivityVerifier<ContractState> {
        /// Verify that a proof meets the threshold
        /// In production, this would verify the actual ZK proof
        /// For now, we trust registered proofs from off-chain service
        fn verify_proof(
            self: @ContractState,
            proof_hash: felt252,
            commitment: felt252,
            threshold: u256,
        ) -> bool {
            let proof_data = self.proof_scores.read(proof_hash);
            
            // Check proof exists and was verified
            if !proof_data.verified {
                return false;
            }
            
            // Check commitment matches
            if proof_data.commitment != commitment {
                return false;
            }
            
            // Check score meets threshold
            let success = proof_data.activity_score >= threshold;
            
            success
        }

        /// Register a proof with its activity score
        /// Called by trusted backend service after generating proof
        fn register_proof(
            ref self: ContractState,
            proof_hash: felt252,
            commitment: felt252,
            activity_score: u256,
        ) {
            let caller = get_caller_address();
            let timestamp = starknet::get_block_timestamp();
            
            // In production, add access control here
            // For now, anyone can register (would use owner or whitelist)
            
            let proof_data = ProofData {
                commitment,
                activity_score,
                verified: true,
                registered_by: caller,
                registered_at: timestamp,
            };
            
            self.proof_scores.write(proof_hash, proof_data);
            
            self.emit(ProofRegistered {
                proof_hash,
                commitment,
                activity_score,
                registered_by: caller,
            });
        }

        /// Get the activity score for a registered proof
        fn get_proof_score(self: @ContractState, proof_hash: felt252) -> u256 {
            let proof_data = self.proof_scores.read(proof_hash);
            proof_data.activity_score
        }
    }
}

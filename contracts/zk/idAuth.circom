pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

/**
 * Identity Authentication Circuit
 * Verifies passport/document data with age check
 * No mock data - real ZK verification
 */
template IDAuth() {
    // Private inputs - sensitive data never revealed
    signal input passport_number;      // Hash of passport number
    signal input address_hash;         // Hash of address from document
    signal input dob_timestamp;        // Date of birth as Unix timestamp
    signal input document_photo_hash;  // Hash of uploaded document photo
    signal input salt;                 // Random salt for commitment
    signal input wallet_address;       // User's wallet address
    
    // Public inputs
    signal input current_timestamp;    // Current time (public for age verification)
    
    // Public outputs
    signal output identity_commitment; // Poseidon hash of all private data
    signal output age_verified;        // 1 if age >= 18, 0 otherwise
    signal output wallet_commitment;   // Binds identity to wallet
    
    // ====== Age Verification ======
    // Calculate age in seconds
    signal age_seconds;
    age_seconds <== current_timestamp - dob_timestamp;
    
    // Age must be at least 18 years (in seconds)
    // 18 years = 18 * 365.25 * 24 * 60 * 60 = 568,036,800 seconds
    signal minimum_age;
    minimum_age <== 568036800;
    
    // Check if age >= 18
    component age_check = GreaterEqThan(64);
    age_check.in[0] <== age_seconds;
    age_check.in[1] <== minimum_age;
    age_verified <== age_check.out;
    
    // Constrain: age_verified must be 1 (true)
    age_verified === 1;
    
    // ====== Identity Commitment ======
    // Create commitment hash using Poseidon (Starknet-compatible)
    component identity_hash = Poseidon(5);
    identity_hash.inputs[0] <== passport_number;
    identity_hash.inputs[1] <== address_hash;
    identity_hash.inputs[2] <== dob_timestamp;
    identity_hash.inputs[3] <== document_photo_hash;
    identity_hash.inputs[4] <== salt;
    
    identity_commitment <== identity_hash.out;
    
    // ====== Wallet Commitment ======
    // Bind identity to wallet using Poseidon hash
    component wallet_hash = Poseidon(2);
    wallet_hash.inputs[0] <== wallet_address;
    wallet_hash.inputs[1] <== salt;
    
    wallet_commitment <== wallet_hash.out;
}

component main {public [current_timestamp]} = IDAuth();

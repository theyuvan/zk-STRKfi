pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

/*
 * Activity Score Verifier Circuit
 * Proves that wallet activity_score >= threshold without revealing exact score
 * 
 * Public Inputs:
 *   - threshold: minimum required activity score (e.g. 500)
 *   - commitment: hash(activity_score, wallet_address, salt)
 * 
 * Private Inputs:
 *   - activity_score: wallet activity score 0-1000 (kept private)
 *   - wallet_address: the wallet being analyzed (kept private)
 *   - salt: random value for commitment
 * 
 * Constraints:
 *   1. commitment == Poseidon(activity_score, wallet_address, salt)
 *   2. activity_score >= threshold
 *   3. activity_score <= 1000 (max score)
 */
template ActivityVerifier() {
    // Public inputs
    signal input threshold;
    signal output commitment;
    
    // Private inputs
    signal input activity_score;
    signal input wallet_address;
    signal input salt;
    
    // Intermediate signals
    signal output isAboveThreshold;
    
    // Constraint 1: Verify commitment
    component poseidon = Poseidon(3);
    poseidon.inputs[0] <== activity_score;
    poseidon.inputs[1] <== wallet_address;
    poseidon.inputs[2] <== salt;
    commitment <== poseidon.out;
    
    // Constraint 2: Verify activity_score >= threshold
    component gte = GreaterEqThan(64);
    gte.in[0] <== activity_score;
    gte.in[1] <== threshold;
    gte.out === 1;
    
    // Constraint 3: Verify activity_score <= 1000 (max score)
    component lte = LessEqThan(64);
    lte.in[0] <== activity_score;
    
    lte.in[1] <== 1000;
    lte.out === 1;
    
    isAboveThreshold <== gte.out;
}

component main {public [threshold]} = ActivityVerifier();

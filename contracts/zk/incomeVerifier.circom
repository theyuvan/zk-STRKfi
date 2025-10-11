pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

/*
 * Income Verifier Circuit
 * Proves that salary >= threshold without revealing exact salary
 * 
 * Public Inputs:
 *   - threshold: minimum required salary
 *   - commitment: hash(salary, salt)
 * 
 * Private Inputs:
 *   - salary: actual salary (kept private)
 *   - salt: random value for commitment
 * 
 * Constraints:
 *   1. commitment == Poseidon(salary, salt)
 *   2. salary >= threshold
 */
template IncomeVerifier() {
    // Public inputs
    signal input threshold;
    signal output commitment;
    
    // Private inputs
    signal input salary;
    signal input salt;
    
    // Intermediate signals
    signal output isAboveThreshold;
    
    // Constraint 1: Verify commitment
    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== salary;
    poseidon.inputs[1] <== salt;
    commitment <== poseidon.out;
    
    // Constraint 2: Verify salary >= threshold
    component gte = GreaterEqThan(64);
    gte.in[0] <== salary;
    gte.in[1] <== threshold;
    gte.out === 1;
    
    isAboveThreshold <== gte.out;
}

component main {public [threshold]} = IncomeVerifier();

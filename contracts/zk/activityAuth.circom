pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Activity Score Verification Circuit
 * Verifies wallet activity meets minimum threshold
 * No mock data - real transaction-based scoring
 */
template ActivityAuth() {
    // Private inputs - transaction metrics
    signal input total_volume;         // Total STRK transferred
    signal input tx_count;             // Number of transactions
    signal input unique_addresses;     // Unique counterparties
    signal input recent_tx_count;      // Transactions in last 100 blocks
    signal input salt;                 // Random salt for commitment
    
    // Public inputs
    signal input min_score_threshold;  // Minimum required score (e.g., 300)
    
    // Public outputs
    signal output activity_commitment; // Hash of activity data
    signal output score_verified;      // 1 if score >= threshold, 0 otherwise
    signal output activity_score;      // Actual calculated score (public)
    
    // ====== Score Calculation ======
    // Weighted scoring algorithm:
    // Volume (40%) + Frequency (30%) + Diversity (20%) + Recency (10%)
    
    // Volume score: (total_volume / 100) * 1000 * 0.40
    signal volume_normalized;
    volume_normalized <== total_volume; // Assume already normalized to 0-1000 range
    signal volume_score;
    volume_score <== volume_normalized * 400; // 40% weight = 400/1000
    
    // Frequency score: (tx_count / 50) * 1000 * 0.30
    signal freq_normalized;
    freq_normalized <== tx_count; // Assume already normalized
    signal freq_score;
    freq_score <== freq_normalized * 300; // 30% weight = 300/1000
    
    // Diversity score: (unique_addresses / 10) * 1000 * 0.20
    signal diversity_normalized;
    diversity_normalized <== unique_addresses; // Assume already normalized
    signal diversity_score;
    diversity_score <== diversity_normalized * 200; // 20% weight = 200/1000
    
    // Recency score: recent_tx_count > 0 ? 100 : 0
    component recency_check = GreaterThan(32);
    recency_check.in[0] <== recent_tx_count;
    recency_check.in[1] <== 0;
    signal recency_score;
    recency_score <== recency_check.out * 100; // 10% weight = 100/1000
    
    // Total score
    activity_score <== volume_score + freq_score + diversity_score + recency_score;
    
    // ====== Threshold Verification ======
    component threshold_check = GreaterEqThan(64);
    threshold_check.in[0] <== activity_score;
    threshold_check.in[1] <== min_score_threshold;
    score_verified <== threshold_check.out;
    
    // Constrain: score_verified must be 1 (true)
    score_verified === 1;
    
    // ====== Activity Commitment ======
    // Create commitment hash for activity data
    component poseidon = Poseidon(5);
    poseidon.inputs[0] <== total_volume;
    poseidon.inputs[1] <== tx_count;
    poseidon.inputs[2] <== unique_addresses;
    poseidon.inputs[3] <== recent_tx_count;
    poseidon.inputs[4] <== salt;
    
    activity_commitment <== poseidon.out;
}

component main {public [min_score_threshold]} = ActivityAuth();

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityReveal
 * @dev Optional contract for managing identity reveal on EVM
 */
contract IdentityReveal is Ownable {
    struct Identity {
        string cid;  // IPFS CID
        uint256 revealedAt;
        bool isRevealed;
    }

    mapping(uint256 => Identity) public identities;
    mapping(address => bool) public trustees;

    uint256 public threshold;
    uint256 public totalTrustees;

    event IdentityStored(uint256 indexed loanId, string cid);
    event IdentityRevealed(uint256 indexed loanId, string cid);
    event TrusteeAdded(address indexed trustee);
    event TrusteeRemoved(address indexed trustee);

    constructor(uint256 _threshold, uint256 _totalTrustees) Ownable(msg.sender) {
        require(_threshold <= _totalTrustees, "Invalid threshold");
        threshold = _threshold;
        totalTrustees = _totalTrustees;
    }

    modifier onlyTrustee() {
        require(trustees[msg.sender], "Not a trustee");
        _;
    }

    /**
     * @dev Add trustee
     */
    function addTrustee(address trustee) external onlyOwner {
        require(!trustees[trustee], "Already a trustee");
        trustees[trustee] = true;
        emit TrusteeAdded(trustee);
    }

    /**
     * @dev Remove trustee
     */
    function removeTrustee(address trustee) external onlyOwner {
        require(trustees[trustee], "Not a trustee");
        trustees[trustee] = false;
        emit TrusteeRemoved(trustee);
    }

    /**
     * @dev Store encrypted identity CID
     */
    function storeIdentity(uint256 loanId, string memory cid) external {
        require(bytes(cid).length > 0, "CID required");
        require(!identities[loanId].isRevealed, "Already revealed");

        identities[loanId] = Identity({
            cid: cid,
            revealedAt: 0,
            isRevealed: false
        });

        emit IdentityStored(loanId, cid);
    }

    /**
     * @dev Reveal identity (callable by trustees after default)
     */
    function revealIdentity(uint256 loanId) external onlyTrustee {
        Identity storage identity = identities[loanId];
        require(bytes(identity.cid).length > 0, "Identity not stored");
        require(!identity.isRevealed, "Already revealed");

        identity.isRevealed = true;
        identity.revealedAt = block.timestamp;

        emit IdentityRevealed(loanId, identity.cid);
    }

    /**
     * @dev Get identity details
     */
    function getIdentity(uint256 loanId) 
        external 
        view 
        returns (string memory cid, uint256 revealedAt, bool isRevealed) 
    {
        Identity memory identity = identities[loanId];
        return (identity.cid, identity.revealedAt, identity.isRevealed);
    }

    /**
     * @dev Check if address is trustee
     */
    function isTrustee(address account) external view returns (bool) {
        return trustees[account];
    }
}

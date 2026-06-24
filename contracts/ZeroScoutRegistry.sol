// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ZeroScoutRegistry {
    address public owner;

    event PassportRegistered(
        string id,
        bytes32 indexed root,
        bytes32 capsuleHash,
        bytes32 storageTxHash,
        string campaignId,
        bool isPublic,
        uint256 createdAt
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "zero owner");
        owner = nextOwner;
    }

    function registerPassport(
        string calldata id,
        bytes32 root,
        bytes32 capsuleHash,
        bytes32 storageTxHash,
        string calldata campaignId,
        bool isPublic
    ) external onlyOwner {
        require(bytes(id).length > 0, "empty id");
        require(root != bytes32(0), "empty root");
        emit PassportRegistered(id, root, capsuleHash, storageTxHash, campaignId, isPublic, block.timestamp);
    }
}

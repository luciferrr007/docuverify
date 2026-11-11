
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DocuVerify {
    address public owner;

    struct Credential {
        bytes32 fingerprint;
        address issuer;
        uint256 registeredAt;
        bool exists;
    }

    mapping(string => Credential) private credentials;

    event CredentialRegistered(
        string tokenId,
        bytes32 fingerprint,
        address indexed issuer,
        uint256 registeredAt
    );

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only platform owner can register credentials"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerCredential(
        string calldata tokenId,
        bytes32 fingerprint,
        address issuer
    ) external onlyOwner {
        require(
            bytes(tokenId).length > 0,
            "Token ID cannot be empty"
        );

        require(
            fingerprint != bytes32(0),
            "Fingerprint cannot be empty"
        );

        require(
            issuer != address(0),
            "Issuer address cannot be zero"
        );

        require(
            !credentials[tokenId].exists,
            "Credential already registered"
        );

        credentials[tokenId] = Credential({
            fingerprint: fingerprint,
            issuer: issuer,
            registeredAt: block.timestamp,
            exists: true
        });

        emit CredentialRegistered(
            tokenId,
            fingerprint,
            issuer,
            block.timestamp
        );
    }

    function getCredential(
        string calldata tokenId
    )
        external
        view
        returns (
            bytes32 fingerprint,
            address issuer,
            uint256 registeredAt,
            bool exists
        )
    {
        Credential memory credential = credentials[tokenId];

        return (
            credential.fingerprint,
            credential.issuer,
            credential.registeredAt,
            credential.exists
        );
    }
}

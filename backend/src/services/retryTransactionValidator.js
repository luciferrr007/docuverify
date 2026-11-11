
const { ethers } = require("ethers");

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const CHAIN_ID = 80002;

const contractInterface = new ethers.Interface([
  "function registerCredential(string tokenId, bytes32 fingerprint, address issuer) external",
]);

function normalize(value) {
  return String(value || "").toLowerCase();
}

function normalizeFingerprint(value) {
  return normalize(value).replace(/^0x/, "");
}

function reject(reason) {
  return {
    eligible: false,
    reason,
  };
}

function validateFailedRetryTransaction({
  credential,
  transaction,
  receipt,
  platformWalletAddress,
}) {
  if (!credential) {
    return reject("Credential is missing.");
  }

  if (credential.status !== "active") {
    return reject("Credential is not active.");
  }

  if (credential.blockchainStatus !== "failed") {
    return reject("Credential is not marked failed.");
  }

  if (
    !/^0x[a-fA-F0-9]{64}$/.test(
      credential.transactionHash || ""
    )
  ) {
    return reject(
      "No valid previous transaction hash is saved."
    );
  }

  if (!transaction || !receipt) {
    return reject(
      "Previous transaction or receipt is unavailable."
    );
  }

  if (
    normalize(transaction.hash) !==
    normalize(credential.transactionHash)
  ) {
    return reject("Transaction hash mismatch.");
  }

  const receiptHash =
    receipt.hash || receipt.transactionHash;

  if (
    normalize(receiptHash) !==
    normalize(credential.transactionHash)
  ) {
    return reject("Transaction receipt hash mismatch.");
  }

  if (Number(receipt.status) !== 0) {
    return reject(
      "Previous transaction is not confirmed reverted."
    );
  }

  if (
    Number(transaction.chainId) !== CHAIN_ID
  ) {
    return reject("Incorrect blockchain chain ID.");
  }

  if (
    !ethers.isAddress(platformWalletAddress || "")
  ) {
    return reject("Invalid platform wallet address.");
  }

  if (
    normalize(transaction.from) !==
    normalize(platformWalletAddress)
  ) {
    return reject("Transaction sender is incorrect.");
  }

  if (
    normalize(transaction.to) !==
    normalize(CONTRACT_ADDRESS)
  ) {
    return reject(
      "Transaction destination is incorrect."
    );
  }

  if (
    receipt.to &&
    normalize(receipt.to) !==
      normalize(CONTRACT_ADDRESS)
  ) {
    return reject(
      "Transaction receipt destination is incorrect."
    );
  }

  let decoded;

  try {
    decoded = contractInterface.parseTransaction({
      data: transaction.data,
      value: transaction.value ?? 0n,
    });
  } catch {
    return reject(
      "Transaction call data could not be decoded."
    );
  }

  if (
    !decoded ||
    decoded.name !== "registerCredential"
  ) {
    return reject(
      "Transaction did not call registerCredential."
    );
  }

  const submittedTokenId = decoded.args[0];

  const submittedFingerprint =
    decoded.args[1];

  const submittedIssuer = decoded.args[2];

  if (
    submittedTokenId !== credential.tokenId
  ) {
    return reject(
      "Transaction Token ID does not match the credential."
    );
  }

  if (
    normalizeFingerprint(submittedFingerprint) !==
    normalizeFingerprint(
      credential.fingerprint
    )
  ) {
    return reject(
      "Transaction fingerprint does not match the credential."
    );
  }

  if (
    normalize(submittedIssuer) !==
    normalize(credential.issuerWalletAddress)
  ) {
    return reject(
      "Transaction issuer does not match the credential."
    );
  }

  return {
    eligible: true,
    reason:
      "Previous transaction was mined and reverted, and its contract call matches the credential.",
    transactionHash:
      credential.transactionHash,
    blockNumber:
      receipt.blockNumber ?? null,
  };
}

module.exports = {
  validateFailedRetryTransaction,
};

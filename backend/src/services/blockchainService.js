
const { ethers } = require("ethers");

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const CONTRACT_ABI = [
  "function registerCredential(string tokenId, bytes32 fingerprint, address issuer) external",
  "function getCredential(string tokenId) external view returns (bytes32 fingerprint, address issuer, uint256 registeredAt, bool exists)",
  "function owner() view returns (address)"
];

const MIN_PRIORITY_FEE = ethers.parseUnits("30", "gwei");
const MIN_MAX_FEE = ethers.parseUnits("60", "gwei");

let provider;
let wallet;
let contract;

function initializeBlockchain() {
  if (contract) {
    return contract;
  }

  const rpcUrl = process.env.POLYGON_AMOY_RPC_URL;
  const privateKey = process.env.POLYGON_AMOY_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error(
      "Polygon Amoy environment variables are missing."
    );
  }

  provider = new ethers.JsonRpcProvider(
    rpcUrl,
    {
      name: "polygon-amoy",
      chainId: 80002
    },
    {
      batchMaxCount: 1
    }
  );

  wallet = new ethers.Wallet(privateKey, provider);

  contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    wallet
  );

  return contract;
}

function getRevertedReceipt(error) {
  if (!error) {
    return null;
  }

  const receipt =
    error.receipt ||
    error.info?.receipt ||
    null;

  if (!receipt || Number(receipt.status) !== 0) {
    return null;
  }

  return receipt;
}

async function getTransactionFees() {
  initializeBlockchain();

  const feeData = await provider.getFeeData();

  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas !== null &&
    feeData.maxPriorityFeePerGas > MIN_PRIORITY_FEE
      ? feeData.maxPriorityFeePerGas
      : MIN_PRIORITY_FEE;

  let maxFeePerGas =
    feeData.maxFeePerGas !== null
      ? feeData.maxFeePerGas
      : MIN_MAX_FEE;

  const latestBlock = await provider.getBlock("latest");

  if (latestBlock && latestBlock.baseFeePerGas !== null) {
    const recommendedMaxFee =
      latestBlock.baseFeePerGas * 2n +
      maxPriorityFeePerGas;

    if (recommendedMaxFee > maxFeePerGas) {
      maxFeePerGas = recommendedMaxFee;
    }
  }

  if (maxFeePerGas < MIN_MAX_FEE) {
    maxFeePerGas = MIN_MAX_FEE;
  }

  if (maxFeePerGas < maxPriorityFeePerGas) {
    maxFeePerGas = maxPriorityFeePerGas;
  }

  console.log("Polygon Amoy gas settings:", {
    maxPriorityFeePerGas:
      ethers.formatUnits(maxPriorityFeePerGas, "gwei") +
      " Gwei",
    maxFeePerGas:
      ethers.formatUnits(maxFeePerGas, "gwei") +
      " Gwei"
  });

  return {
    maxPriorityFeePerGas,
    maxFeePerGas
  };
}

async function registerCredentialOnBlockchain(
  tokenId,
  fingerprint,
  issuerWalletAddress,
  onTransactionSubmitted
) {
  const docuVerify = initializeBlockchain();

  if (!/^0x[a-fA-F0-9]{64}$/.test(fingerprint)) {
    throw new Error("Invalid bytes32 fingerprint format.");
  }

  if (!ethers.isAddress(issuerWalletAddress)) {
    throw new Error("Invalid institution wallet address.");
  }

  const fees = await getTransactionFees();

  const transaction = await docuVerify.registerCredential(
    tokenId,
    fingerprint,
    issuerWalletAddress,
    {
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      maxFeePerGas: fees.maxFeePerGas
    }
  );

  const transactionDetails = {
    transactionHash: transaction.hash,
    nonce: transaction.nonce,
    chainId: transaction.chainId.toString(),
    contractAddress: CONTRACT_ADDRESS
  };

  if (typeof onTransactionSubmitted === "function") {
    try {
      await onTransactionSubmitted(transactionDetails);
    } catch (error) {
      error.transactionHash = transaction.hash;
      error.transactionSubmitted = true;
      error.transactionDetails = transactionDetails;

      throw error;
    }
  }

  let receipt;

  try {
    receipt = await transaction.wait();
  } catch (error) {
    const failedReceipt = getRevertedReceipt(error);

    if (failedReceipt) {
      const revertedError = new Error(
        "Blockchain transaction was mined but reverted."
      );

      revertedError.transactionHash = transaction.hash;
      revertedError.transactionSubmitted = true;
      revertedError.transactionFailed = true;
      revertedError.transactionMined = true;

      revertedError.transactionDetails = {
        ...transactionDetails,
        blockNumber: failedReceipt.blockNumber
      };

      throw revertedError;
    }

    error.transactionHash = transaction.hash;
    error.transactionSubmitted = true;
    error.transactionDetails = transactionDetails;

    throw error;
  }

  if (!receipt || Number(receipt.status) !== 1) {
    const error = new Error(
      "Blockchain credential registration failed."
    );

    error.transactionHash = transaction.hash;
    error.transactionSubmitted = true;
    error.transactionFailed = true;
    error.transactionMined = Boolean(receipt);

    error.transactionDetails = {
      ...transactionDetails,
      blockNumber: receipt?.blockNumber ?? null
    };

    throw error;
  }

  return {
    transactionHash: transaction.hash,
    blockNumber: receipt.blockNumber,
    contractAddress: CONTRACT_ADDRESS,
    status: "confirmed"
  };
}

async function checkTransactionStatus(transactionHash) {
  initializeBlockchain();

  if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
    throw new Error("Invalid transaction hash.");
  }

  const receipt = await provider.getTransactionReceipt(
    transactionHash
  );

  if (receipt) {
    if (Number(receipt.status) === 1) {
      return {
        transactionHash,
        status: "confirmed",
        blockNumber: receipt.blockNumber,
        contractAddress: receipt.to,
        from: receipt.from,
        to: receipt.to
      };
    }

    return {
      transactionHash,
      status: "failed",
      blockNumber: receipt.blockNumber,
      contractAddress: receipt.to,
      from: receipt.from,
      to: receipt.to
    };
  }

  const transaction = await provider.getTransaction(
    transactionHash
  );

  if (transaction) {
    return {
      transactionHash,
      status: "pending",
      blockNumber: null,
      from: transaction.from,
      to: transaction.to
    };
  }

  return {
    transactionHash,
    status: "not_found",
    blockNumber: null
  };
}

async function getCredentialFromBlockchain(tokenId) {
  const docuVerify = initializeBlockchain();

  const result = await docuVerify.getCredential(tokenId);

  return {
    fingerprint: result.fingerprint,
    issuer: result.issuer,
    registeredAt: result.registeredAt.toString(),
    exists: result.exists
  };
}

async function getPlatformWalletAddress() {
  initializeBlockchain();

  return wallet.address;
}

module.exports = {
  initializeBlockchain,
  registerCredentialOnBlockchain,
  checkTransactionStatus,
  getCredentialFromBlockchain,
  getPlatformWalletAddress,
  getRevertedReceipt
};

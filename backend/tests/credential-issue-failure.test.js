
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

test("marks a mined and reverted credential transaction as failed", async () => {
  const transactionHash =
    "0x419f34916802312f79e7c8c48f106612d324c3d339bff723d000b875da7ff4c1";

  const blockNumber = 52350000;
  const updates = [];

  // Simulated MongoDB model
  const Credential = {
    findOne: async () => null,

    create: async (data) => ({
      _id: "test-credential-id",
      ...data,
    }),

    findByIdAndUpdate: async (id, update) => {
      updates.push({ id, update });

      return {
        _id: id,
        ...update,
      };
    },
  };

  // Simulated institution authentication
  const institutionAuthMiddleware = (req, res, next) => {
    req.institution = {
      institutionName: "Demo University",
      walletAddress:
        "0x000000000000000000000000000000000000dead",
    };

    next();
  };

  // Simulated blockchain service
  const blockchainService = {
    registerCredentialOnBlockchain: async (
      tokenId,
      fingerprint,
      issuerWalletAddress,
      onTransactionSubmitted
    ) => {
      const transactionDetails = {
        transactionHash,
        nonce: 5,
        chainId: "80002",
        contractAddress:
          "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2",
      };

      // Simulate successful transaction submission
      await onTransactionSubmitted(transactionDetails);

      // Simulate a mined but reverted transaction
      const error = new Error(
        "Blockchain transaction was mined but reverted."
      );

      error.transactionHash = transactionHash;
      error.transactionSubmitted = true;
      error.transactionFailed = true;
      error.transactionMined = true;

      error.transactionDetails = {
        ...transactionDetails,
        blockNumber,
      };

      throw error;
    },

    getCredentialFromBlockchain: async () => ({}),
    checkTransactionStatus: async () => ({}),
    getPlatformWalletAddress: async () => "0x000000000000000000000000000000000000dead",
  };

  const credentialRoutes = proxyquire(
    "../src/routes/credentialRoutes",
    {
      "../models/Credential": Credential,

      "../utils/credentialHash": {
        generateCredentialFingerprint: () => "a".repeat(64),
      },

      "../middleware/institutionAuthMiddleware":
        institutionAuthMiddleware,

      "../services/blockchainService": blockchainService,
    }
  );

  const app = express();

  app.use(express.json());
  app.use("/api/credentials", credentialRoutes);

  const response = await supertest(app)
    .post("/api/credentials/issue")
    .send({
      tokenId: "DV-FAILURE-TEST-001",
      documentType: "Academic Certificate",
      documentTypeKey: "academic",
      data: {
        degreeId: "DEG-TEST-001",
        regNumber: "REG-TEST-001",
        holderName: "Test Student",
        degreeTitle: "Bachelor of Technology",
        yearOfCompletion: "2026",
      },
      fingerprint: "a".repeat(64),
      issuedAt: "2026-11-09T10:00:00.000Z",
    });

  // Check API response
  assert.equal(response.status, 502);
  assert.equal(response.body.success, false);
  assert.equal(response.body.blockchainStatus, "failed");
  assert.equal(response.body.transactionHash, transactionHash);
  assert.equal(response.body.blockNumber, blockNumber);

  // Check MongoDB failure-status update
  const failedUpdate = updates.find(
    (entry) => entry.update.blockchainStatus === "failed"
  );

  assert.ok(failedUpdate);
  assert.equal(
    failedUpdate.update.transactionHash,
    transactionHash
  );
  assert.equal(
    failedUpdate.update.blockNumber,
    blockNumber
  );

  console.log("API response:", response.body);
  console.log("MongoDB failed-status update:", failedUpdate);
});

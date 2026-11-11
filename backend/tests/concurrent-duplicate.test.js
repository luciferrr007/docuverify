
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

test("only one simultaneous request can create the same Token ID", async () => {
  let credentialExists = false;
  let createCalls = 0;
  let blockchainCalls = 0;

  // Simulate a database unique index.
  const Credential = {
    findOne: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));

      return null;
    },

    create: async (data) => {
      createCalls++;

      // Simulate MongoDB's unique index.
      if (credentialExists) {
        const error = new Error("Duplicate key");
        error.code = 11000;
        throw error;
      }

      credentialExists = true;

      return {
        _id: "concurrent-test-id",
        ...data,
      };
    },

    findByIdAndUpdate: async (id, update) => ({
      _id: id,
      ...update,
    }),
  };

  const institutionAuthMiddleware = (req, res, next) => {
    req.institution = {
      institutionName: "Demo University",
      walletAddress:
        "0x000000000000000000000000000000000000dead",
    };

    next();
  };

  const blockchainService = {
    registerCredentialOnBlockchain: async () => {
      blockchainCalls++;

      return {
        transactionHash:
          "0x419f34916802312f79e7c8c48f106612d324c3d339bff723d000b875da7ff4c1",
        blockNumber: 52350000,
        contractAddress:
          "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2",
        status: "confirmed",
      };
    },

    getCredentialFromBlockchain: async () => ({}),
    checkTransactionStatus: async () => ({}),
    getPlatformWalletAddress: async () => "",
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

  const payload = {
    tokenId: "DV-CONCURRENT-TEST-001",
    documentType: "Academic Certificate",
    documentTypeKey: "academic",
    data: {
      degreeId: "DEG-001",
      regNumber: "REG-001",
      holderName: "Test Student",
      degreeTitle: "Bachelor of Technology",
      yearOfCompletion: "2026",
    },
    fingerprint: "a".repeat(64),
    issuedAt: "2026-11-09T10:00:00.000Z",
  };

  // Send both requests simultaneously.
  const [responseA, responseB] = await Promise.all([
    supertest(app).post("/api/credentials/issue").send(payload),
    supertest(app).post("/api/credentials/issue").send(payload),
  ]);

  const statuses = [
    responseA.status,
    responseB.status,
  ].sort();

  assert.deepEqual(statuses, [201, 409]);

  assert.equal(createCalls, 2);
  assert.equal(blockchainCalls, 1);
  assert.equal(credentialExists, true);

  console.log("Request A:", responseA.status);
  console.log("Request B:", responseB.status);
  console.log("Credential creation attempts:", createCalls);
  console.log("Blockchain registrations:", blockchainCalls);
});

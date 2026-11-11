
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const validInstitution = (req, res, next) => {
  req.institution = {
    institutionName: "Demo University",
    walletAddress: "0x000000000000000000000000000000000000dead",
  };
  next();
};

function createApp(Credential, blockchainCalls) {
  const routes = proxyquire(
    "../src/routes/credentialRoutes",
    {
      "../models/Credential": Credential,
      "../utils/credentialHash": {
        generateCredentialFingerprint: () => "a".repeat(64),
      },
      "../middleware/institutionAuthMiddleware": validInstitution,
      "../services/blockchainService": {
        registerCredentialOnBlockchain: async () => {
          blockchainCalls.count++;
          throw new Error("Blockchain should not be called");
        },
        getCredentialFromBlockchain: async () => ({}),
        checkTransactionStatus: async () => ({}),
        getPlatformWalletAddress: async () => "",
      },
    }
  );

  const app = express();
  app.use(express.json());
  app.use("/api/credentials", routes);
  return app;
}

const payload = {
  tokenId: "DV-DB-FAILURE-001",
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

test("does not submit to blockchain when MongoDB lookup fails", async () => {
  const blockchainCalls = { count: 0 };

  const Credential = {
    findOne: async () => {
      throw new Error("Simulated MongoDB unavailable");
    },
  };

  const response = await supertest(
    createApp(Credential, blockchainCalls)
  )
    .post("/api/credentials/issue")
    .send(payload);

  assert.equal(response.status, 500);
  assert.equal(response.body.success, false);
  assert.equal(blockchainCalls.count, 0);
});

test("does not submit to blockchain when MongoDB creation fails", async () => {
  const blockchainCalls = { count: 0 };

  const Credential = {
    findOne: async () => null,
    create: async () => {
      throw new Error("Simulated MongoDB write failure");
    },
  };

  const response = await supertest(
    createApp(Credential, blockchainCalls)
  )
    .post("/api/credentials/issue")
    .send(payload);

  assert.equal(response.status, 500);
  assert.equal(response.body.success, false);
  assert.equal(blockchainCalls.count, 0);
});

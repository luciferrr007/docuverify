
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const TOKEN_ID = "DV-TAMPERED-TEST-001";

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const ISSUER_WALLET =
  "0x000000000000000000000000000000000000dead";

function createApp(Credential, calls) {
  const routes = proxyquire(
    "../src/routes/credentialRoutes",
    {
      "../models/Credential": Credential,

      // Simulate the fingerprint calculated from
      // the modified credential data.
      "../utils/credentialHash": {
        generateCredentialFingerprint: () => "b".repeat(64),
      },

      "../middleware/institutionAuthMiddleware": (
        req, res, next
      ) => next(),

      "../services/blockchainService": {
        getCredentialFromBlockchain: async () => {
          calls.blockchainLookup++;

          return {
            fingerprint: "0x" + "a".repeat(64),
            issuer: ISSUER_WALLET,
            registeredAt: "1794200000",
            exists: true,
          };
        },
      },
    }
  );

  const app = express();
  app.use(express.json());
  app.use("/api/credentials", routes);

  return app;
}

test("detects tampered credential data", async () => {
  const calls = {
    databaseLookup: 0,
    blockchainLookup: 0,
  };

  const credential = {
    tokenId: TOKEN_ID,
    documentType: "Academic Certificate",
    documentTypeKey: "academic",

    // Modified data
    data: {
      degreeId: "DEG-001",
      regNumber: "REG-001",
      holderName: "Test Student",
      degreeTitle: "Master of Technology",
      yearOfCompletion: "2026",
      issuer: "Demo University",
    },

    // Original stored fingerprint
    fingerprint: "a".repeat(64),

    issuerName: "Demo University",
    issuerWalletAddress: ISSUER_WALLET,
    blockchainStatus: "confirmed",
    contractAddress: CONTRACT_ADDRESS,
    status: "active",
  };

  const Credential = {
    findOne: async (query) => {
      calls.databaseLookup++;
      assert.equal(query.tokenId, TOKEN_ID);
      return credential;
    },
  };

  const response = await supertest(
    createApp(Credential, calls)
  ).get(`/api/credentials/${TOKEN_ID}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  assert.equal(
    response.body.message,
    "Credential data integrity check failed."
  );

  assert.equal(
    response.body.verification.integrityValid,
    false
  );

  assert.equal(
    response.body.verification.isValid,
    false
  );

  assert.equal(calls.databaseLookup, 1);
  assert.equal(calls.blockchainLookup, 1);
});

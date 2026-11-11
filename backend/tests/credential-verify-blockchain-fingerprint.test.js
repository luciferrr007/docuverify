
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const TOKEN_ID = "DV-BLOCKCHAIN-FINGERPRINT-001";

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const ISSUER_WALLET =
  "0x000000000000000000000000000000000000dead";

const MONGODB_FINGERPRINT = "a".repeat(64);
const BLOCKCHAIN_FINGERPRINT = "b".repeat(64);

function createApp(Credential, calls) {
  const routes = proxyquire(
    "../src/routes/credentialRoutes",
    {
      "../models/Credential": Credential,

      "../utils/credentialHash": {
        generateCredentialFingerprint: () =>
          MONGODB_FINGERPRINT,
      },

      "../middleware/institutionAuthMiddleware": (
        req, res, next
      ) => next(),

      "../services/blockchainService": {
        getCredentialFromBlockchain: async (tokenId) => {
          calls.blockchainLookup++;

          assert.equal(tokenId, TOKEN_ID);

          return {
            fingerprint: "0x" + BLOCKCHAIN_FINGERPRINT,
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

test("rejects credential when blockchain fingerprint does not match", async () => {
  const calls = {
    databaseLookup: 0,
    blockchainLookup: 0,
  };

  const credential = {
    tokenId: TOKEN_ID,
    documentType: "Academic Certificate",
    documentTypeKey: "academic",

    data: {
      degreeId: "DEG-001",
      regNumber: "REG-001",
      holderName: "Test Student",
      degreeTitle: "Bachelor of Technology",
      yearOfCompletion: "2026",
      issuer: "Demo University",
    },

    fingerprint: MONGODB_FINGERPRINT,
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
    response.body.verification.integrityValid,
    true
  );

  assert.equal(
    response.body.verification.blockchainRecordExists,
    true
  );

  assert.equal(
    response.body.verification.blockchainFingerprintMatches,
    false
  );

  assert.equal(
    response.body.verification.blockchainVerified,
    false
  );

  assert.equal(
    response.body.verification.isValid,
    false
  );

  assert.equal(
    response.body.message,
    "Blockchain fingerprint does not match."
  );

  assert.equal(calls.databaseLookup, 1);
  assert.equal(calls.blockchainLookup, 1);
});

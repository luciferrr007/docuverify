
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const TOKEN_ID = "DV-ISSUER-MISMATCH-001";
const FINGERPRINT = "a".repeat(64);

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const MONGODB_ISSUER =
  "0x000000000000000000000000000000000000dead";

const BLOCKCHAIN_ISSUER =
  "0x000000000000000000000000000000000000beef";

function createApp(Credential, calls) {
  const routes = proxyquire(
    "../src/routes/credentialRoutes",
    {
      "../models/Credential": Credential,

      "../utils/credentialHash": {
        generateCredentialFingerprint: () => FINGERPRINT,
      },

      "../middleware/institutionAuthMiddleware": (
        req, res, next
      ) => next(),

      "../services/blockchainService": {
        getCredentialFromBlockchain: async (tokenId) => {
          calls.blockchainLookup++;

          assert.equal(tokenId, TOKEN_ID);

          return {
            fingerprint: "0x" + FINGERPRINT,
            issuer: BLOCKCHAIN_ISSUER,
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

test("rejects credential when blockchain issuer does not match MongoDB", async () => {
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

    fingerprint: FINGERPRINT,
    issuerName: "Demo University",
    issuerWalletAddress: MONGODB_ISSUER,
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
    response.body.verification.blockchainFingerprintMatches,
    true
  );

  assert.equal(
    response.body.verification.blockchainIssuerMatches,
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
    "Blockchain issuer does not match the institution record."
  );

  assert.equal(calls.databaseLookup, 1);
  assert.equal(calls.blockchainLookup, 1);
});

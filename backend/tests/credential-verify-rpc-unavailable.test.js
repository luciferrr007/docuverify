
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const TOKEN_ID = "DV-RPC-UNAVAILABLE-001";
const FINGERPRINT = "a".repeat(64);

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const ISSUER_WALLET =
  "0x000000000000000000000000000000000000dead";

test("returns an unavailable response when blockchain RPC fails", async () => {
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
        getCredentialFromBlockchain: async () => {
          calls.blockchainLookup++;

          throw new Error(
            "Simulated Polygon RPC connection failure"
          );
        },
      },
    }
  );

  const app = express();
  app.use(express.json());
  app.use("/api/credentials", routes);

  const response = await supertest(app)
    .get(`/api/credentials/${TOKEN_ID}`);

  assert.equal(response.status, 503);
  assert.equal(response.body.success, false);

  assert.equal(
    response.body.message,
    "Blockchain verification is temporarily unavailable. Please try again later."
  );

  assert.equal(
    response.body.verification.blockchainAvailable,
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

  assert.equal(calls.databaseLookup, 1);
  assert.equal(calls.blockchainLookup, 1);
});

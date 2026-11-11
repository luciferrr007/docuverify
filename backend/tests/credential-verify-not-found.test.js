
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const TOKEN_ID = "DV-FAKE-TOKEN-999";

function createApp(Credential, calls) {
  const routes = proxyquire(
    "../src/routes/credentialRoutes",
    {
      "../models/Credential": Credential,

      "../utils/credentialHash": {
        generateCredentialFingerprint: () => "a".repeat(64),
      },

      "../middleware/institutionAuthMiddleware": (
        req, res, next
      ) => next(),

      "../services/blockchainService": {
        getCredentialFromBlockchain: async () => {
          calls.blockchainLookup++;
          throw new Error("Should not query blockchain");
        },
      },
    }
  );

  const app = express();
  app.use(express.json());
  app.use("/api/credentials", routes);

  return app;
}

test("returns 404 when credential Token ID does not exist", async () => {
  const calls = {
    databaseLookup: 0,
    blockchainLookup: 0,
  };

  const Credential = {
    findOne: async (query) => {
      calls.databaseLookup++;
      assert.equal(query.tokenId, TOKEN_ID);
      return null;
    },
  };

  const response = await supertest(
    createApp(Credential, calls)
  ).get(`/api/credentials/${TOKEN_ID}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Credential not found."
  );

  assert.equal(calls.databaseLookup, 1);
  assert.equal(calls.blockchainLookup, 0);
});

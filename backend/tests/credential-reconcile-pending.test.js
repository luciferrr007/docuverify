
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const VALID_HASH = "0x" + "a".repeat(64);

const TOKEN_ID = "DV-PENDING-TEST-001";

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
          blockchainCalls.register++;
          throw new Error("Registration should not be called");
        },

        getCredentialFromBlockchain: async () => {
          blockchainCalls.getCredential++;
          return {};
        },

        checkTransactionStatus: async (hash) => {
          blockchainCalls.statusCheck++;

          assert.equal(hash, VALID_HASH);

          return {
            transactionHash: VALID_HASH,
            status: "pending",
            blockNumber: null,
            from: "0x000000000000000000000000000000000000dead",
            to: "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2",
          };
        },

        getPlatformWalletAddress: async () => {
          blockchainCalls.getPlatformWallet++;
          return "0x000000000000000000000000000000000000dead";
        },
      },
    }
  );

  const app = express();

  app.use(express.json());
  app.use("/api/credentials", routes);

  return app;
}

test("returns pending when blockchain transaction is not mined", async () => {
  const blockchainCalls = {
    register: 0,
    statusCheck: 0,
    getCredential: 0,
    getPlatformWallet: 0,
    databaseUpdates: 0,
  };

  const credential = {
    _id: "mock-credential-id",
    tokenId: TOKEN_ID,
    issuerWalletAddress:
      "0x000000000000000000000000000000000000dead",
    transactionHash: VALID_HASH,
    blockchainStatus: "pending",
    fingerprint: "a".repeat(64),
  };

  const Credential = {
    findOne: async (query) => {
      assert.equal(query.tokenId, TOKEN_ID);

      return credential;
    },

    findByIdAndUpdate: async () => {
      blockchainCalls.databaseUpdates++;

      throw new Error(
        "Database should not be updated for a pending transaction"
      );
    },
  };

  const response = await supertest(
    createApp(Credential, blockchainCalls)
  )
    .post(`/api/credentials/reconcile/${TOKEN_ID}`)
    .send({});

  assert.equal(response.status, 200);

  assert.equal(response.body.success, true);

  assert.equal(
    response.body.message,
    "Transaction is still pending on Polygon."
  );

  assert.equal(response.body.blockchainStatus, "pending");

  assert.equal(response.body.transactionHash, VALID_HASH);

  assert.equal(blockchainCalls.statusCheck, 1);

  assert.equal(blockchainCalls.register, 0);

  assert.equal(blockchainCalls.getCredential, 0);

  assert.equal(blockchainCalls.getPlatformWallet, 0);

  assert.equal(blockchainCalls.databaseUpdates, 0);
});

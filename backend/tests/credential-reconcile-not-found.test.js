
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const TOKEN_ID = "DV-NOT-FOUND-TEST-001";
const VALID_HASH = "0x" + "c".repeat(64);

const PLATFORM_WALLET =
  "0x000000000000000000000000000000000000dead";

const validInstitution = (req, res, next) => {
  req.institution = {
    institutionName: "Demo University",
    walletAddress: PLATFORM_WALLET,
  };
  next();
};

function createApp(Credential, calls) {
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
          calls.register++;
          throw new Error("Should not register again");
        },

        checkTransactionStatus: async (hash) => {
          calls.statusCheck++;

          assert.equal(hash, VALID_HASH);

          return {
            transactionHash: VALID_HASH,
            status: "not_found",
            blockNumber: null,
          };
        },

        getCredentialFromBlockchain: async () => {
          calls.getCredential++;
          throw new Error("Should not read credential");
        },

        getPlatformWalletAddress: async () => {
          calls.platformWallet++;
          return PLATFORM_WALLET;
        },
      },
    }
  );

  const app = express();
  app.use(express.json());
  app.use("/api/credentials", routes);

  return app;
}

test("keeps credential pending when transaction is not found", async () => {
  const calls = {
    statusCheck: 0,
    register: 0,
    getCredential: 0,
    platformWallet: 0,
    databaseUpdates: 0,
  };

  const credential = {
    _id: "mock-not-found-credential-id",
    tokenId: TOKEN_ID,
    issuerWalletAddress: PLATFORM_WALLET,
    fingerprint: "a".repeat(64),
    transactionHash: VALID_HASH,
    blockchainStatus: "pending",
  };

  const Credential = {
    findOne: async (query) => {
      assert.equal(query.tokenId, TOKEN_ID);
      assert.equal(
        query.issuerWalletAddress,
        PLATFORM_WALLET
      );

      return credential;
    },

    findByIdAndUpdate: async () => {
      calls.databaseUpdates++;

      throw new Error(
        "Database should not be updated for a not-found transaction"
      );
    },
  };

  const response = await supertest(
    createApp(Credential, calls)
  )
    .post(`/api/credentials/reconcile/${TOKEN_ID}`)
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  assert.equal(
    response.body.blockchainStatus,
    "pending"
  );

  assert.equal(
    response.body.transactionHash,
    VALID_HASH
  );

  assert.match(
    response.body.message,
    /not currently found/i
  );

  assert.equal(calls.statusCheck, 1);
  assert.equal(calls.register, 0);
  assert.equal(calls.getCredential, 0);
  assert.equal(calls.platformWallet, 0);
  assert.equal(calls.databaseUpdates, 0);
});

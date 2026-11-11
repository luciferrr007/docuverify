
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const TOKEN_ID = "DV-CONFIRMED-TEST-001";
const VALID_HASH = "0x" + "a".repeat(64);
const FINGERPRINT = "a".repeat(64);

const PLATFORM_WALLET =
  "0x000000000000000000000000000000000000dead";

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

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
        generateCredentialFingerprint: () => FINGERPRINT,
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
            status: "confirmed",
            blockNumber: 52350000,
            from: PLATFORM_WALLET,
            to: CONTRACT_ADDRESS,
          };
        },

        getPlatformWalletAddress: async () => {
          calls.platformWallet++;
          return PLATFORM_WALLET;
        },

        getCredentialFromBlockchain: async (tokenId) => {
          calls.getCredential++;

          assert.equal(tokenId, TOKEN_ID);

          return {
            fingerprint: "0x" + FINGERPRINT,
            issuer: PLATFORM_WALLET,
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

test("confirms credential only after all blockchain checks pass", async () => {
  const calls = {
    statusCheck: 0,
    platformWallet: 0,
    getCredential: 0,
    register: 0,
    databaseUpdates: 0,
  };

  const credential = {
    _id: "mock-credential-id",
    tokenId: TOKEN_ID,
    issuerWalletAddress: PLATFORM_WALLET,
    fingerprint: FINGERPRINT,
    transactionHash: VALID_HASH,
    blockchainStatus: "pending",
    status: "active",
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

    findByIdAndUpdate: async (id, update) => {
      calls.databaseUpdates++;

      assert.equal(id, credential._id);
      assert.equal(update.blockchainStatus, "confirmed");
      assert.equal(update.transactionHash, VALID_HASH);
      assert.equal(update.blockNumber, 52350000);
      assert.equal(update.contractAddress, CONTRACT_ADDRESS);

      return {
        ...credential,
        ...update,
      };
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
    "confirmed"
  );

  assert.equal(
    response.body.blockchain.fingerprintMatches,
    true
  );

  assert.equal(
    response.body.blockchain.issuerMatches,
    true
  );

  assert.equal(calls.statusCheck, 1);
  assert.equal(calls.platformWallet, 1);
  assert.equal(calls.getCredential, 1);
  assert.equal(calls.register, 0);
  assert.equal(calls.databaseUpdates, 1);
});

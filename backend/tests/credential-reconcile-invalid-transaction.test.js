
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const TOKEN_ID = "DV-INVALID-TX-TEST-001";
const VALID_HASH = "0x" + "d".repeat(64);

const PLATFORM_WALLET =
  "0x000000000000000000000000000000000000dead";

const WRONG_WALLET =
  "0x000000000000000000000000000000000000beef";

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const WRONG_CONTRACT =
  "0x0000000000000000000000000000000000001234";

const validInstitution = (req, res, next) => {
  req.institution = {
    institutionName: "Demo University",
    walletAddress: PLATFORM_WALLET,
  };

  next();
};

function createApp(Credential, calls, transaction) {
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

        checkTransactionStatus: async () => {
          calls.statusCheck++;

          return {
            transactionHash: VALID_HASH,
            status: "confirmed",
            blockNumber: 52370000,
            from: transaction.from,
            to: transaction.to,
          };
        },

        getPlatformWalletAddress: async () => {
          calls.platformWallet++;
          return PLATFORM_WALLET;
        },

        getCredentialFromBlockchain: async () => {
          calls.getCredential++;

          throw new Error(
            "Credential should not be read after transaction mismatch"
          );
        },
      },
    }
  );

  const app = express();
  app.use(express.json());
  app.use("/api/credentials", routes);

  return app;
}

async function runInvalidTransactionTest(transaction) {
  const calls = {
    statusCheck: 0,
    platformWallet: 0,
    getCredential: 0,
    register: 0,
    databaseUpdates: 0,
  };

  const credential = {
    _id: "mock-invalid-transaction-id",
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
        "MongoDB should not be updated after transaction mismatch"
      );
    },
  };

  const response = await supertest(
    createApp(Credential, calls, transaction)
  )
    .post(`/api/credentials/reconcile/${TOKEN_ID}`)
    .send({});

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);

  assert.match(
    response.body.message,
    /sender or destination does not match/i
  );

  assert.equal(
    response.body.blockchainStatus,
    "pending"
  );

  assert.equal(calls.statusCheck, 1);
  assert.equal(calls.platformWallet, 1);
  assert.equal(calls.getCredential, 0);
  assert.equal(calls.register, 0);
  assert.equal(calls.databaseUpdates, 0);

  return response;
}

test("rejects transaction sent from the wrong wallet", async () => {
  await runInvalidTransactionTest({
    from: WRONG_WALLET,
    to: CONTRACT_ADDRESS,
  });
});

test("rejects transaction sent to the wrong contract", async () => {
  await runInvalidTransactionTest({
    from: PLATFORM_WALLET,
    to: WRONG_CONTRACT,
  });
});

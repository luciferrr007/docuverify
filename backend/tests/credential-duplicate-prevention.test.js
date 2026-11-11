
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();
const crypto = require("crypto");

const WALLET =
  "0x000000000000000000000000000000000000dead";

const CONTRACT =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const FINGERPRINT = "a".repeat(64);

const TX_HASH = "0x" + "b".repeat(64);

function makePayload(tokenId) {
  return {
    tokenId,
    documentType: "Academic Degree",
    documentTypeKey: "academic",
    data: {
      holderName: "Test Student",
      regNumber: "TEST2026001",
      degreeId: "TEST-DEG-001",
      degreeTitle: "B.Tech",
      yearOfCompletion: "2026",
      issuer: "Demo University",
    },
    fingerprint: FINGERPRINT,
    issuedAt: "2026-11-11T00:00:00.000Z",
  };
}

function makeCredential(tokenId, blockchainStatus) {
  return {
    _id: "existing-credential-id",
    ...makePayload(tokenId),
    issuerName: "Demo University",
    issuerWalletAddress: WALLET,
    blockchainStatus,
    status: "active",
    transactionHash:
      blockchainStatus === "failed" ? undefined : TX_HASH,
  };
}

function getIssuanceKey() {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        WALLET,
        "academic",
        FINGERPRINT,
      ])
    )
    .digest("hex");
}

function createTestEnvironment(existing = []) {
  const records = [...existing];

  let blockchainCalls = 0;
  let createCalls = 0;

  const Credential = {
    findOne: async (query) => {
      if (query.tokenId !== undefined) {
        return (
          records.find(
            (record) => record.tokenId === query.tokenId
          ) || null
        );
      }

      if (query.issuanceKey !== undefined) {
        return (
          records.find(
            (record) =>
              record.issuanceKey === query.issuanceKey &&
              record.issuerWalletAddress ===
                query.issuerWalletAddress
          ) || null
        );
      }

      return (
        records.find(
          (record) =>
            record.issuerWalletAddress ===
              query.issuerWalletAddress &&
            record.documentTypeKey ===
              query.documentTypeKey &&
            record.fingerprint === query.fingerprint
        ) || null
      );
    },

    create: async (data) => {
      createCalls++;

      if (
        records.some(
          (record) => record.tokenId === data.tokenId
        )
      ) {
        const error = new Error("Duplicate Token ID");
        error.code = 11000;
        error.keyPattern = { tokenId: 1 };
        throw error;
      }

      if (
        records.some(
          (record) =>
            record.issuanceKey &&
            record.issuanceKey === data.issuanceKey
        )
      ) {
        const error = new Error(
          "Duplicate issuance key"
        );

        error.code = 11000;
        error.keyPattern = { issuanceKey: 1 };

        throw error;
      }

      const record = {
        _id: `credential-${records.length + 1}`,
        ...data,
      };

      records.push(record);

      return record;
    },

    findByIdAndUpdate: async (id, update) => {
      const record = records.find(
        (item) => item._id === id
      );

      if (!record) return null;

      Object.assign(record, update);

      return record;
    },
  };

  const institutionAuthMiddleware = (
    req,
    res,
    next
  ) => {
    req.institution = {
      institutionName: "Demo University",
      walletAddress: WALLET,
    };

    next();
  };

  const blockchainService = {
    registerCredentialOnBlockchain: async () => {
      blockchainCalls++;

      return {
        transactionHash: TX_HASH,
        blockNumber: 52516222,
        contractAddress: CONTRACT,
        status: "confirmed",
      };
    },

    getCredentialFromBlockchain: async () => ({}),
    checkTransactionStatus: async () => ({}),
    getPlatformWalletAddress: async () => WALLET,
  };

  const router = proxyquire(
    "../src/routes/credentialRoutes",
    {
      "../models/Credential": Credential,

      "../utils/credentialHash": {
        generateCredentialFingerprint: () =>
          FINGERPRINT,
      },

      "../middleware/institutionAuthMiddleware":
        institutionAuthMiddleware,

      "../services/blockchainService":
        blockchainService,
    }
  );

  const app = express();

  app.use(express.json());

  app.use("/api/credentials", router);

  return {
    app,
    records,
    getBlockchainCalls: () => blockchainCalls,
    getCreateCalls: () => createCalls,
  };
}

test(
  "rejects an already confirmed credential with a different Token ID",
  async () => {
    const existing = makeCredential(
      "DCR-2026-AAAA1111",
      "confirmed"
    );

    const env = createTestEnvironment([existing]);

    const response = await supertest(env.app)
      .post("/api/credentials/issue")
      .send(makePayload("DCR-2026-BBBB2222"));

    assert.equal(response.status, 409);
    assert.equal(response.body.duplicate, true);

    assert.equal(
      response.body.existingCredential.tokenId,
      "DCR-2026-AAAA1111"
    );

    assert.equal(
      response.body.existingCredential.blockchainStatus,
      "confirmed"
    );

    assert.equal(env.records.length, 1);
    assert.equal(env.getCreateCalls(), 0);
    assert.equal(env.getBlockchainCalls(), 0);
  }
);

test(
  "rejects an identical credential while its transaction is pending",
  async () => {
    const env = createTestEnvironment([
      makeCredential(
        "DCR-2026-AAAA2222",
        "pending"
      ),
    ]);

    const response = await supertest(env.app)
      .post("/api/credentials/issue")
      .send(makePayload("DCR-2026-BBBB3333"));

    assert.equal(response.status, 409);
    assert.equal(response.body.duplicate, true);

    assert.equal(
      response.body.existingCredential.blockchainStatus,
      "pending"
    );

    assert.equal(env.records.length, 1);
    assert.equal(env.getBlockchainCalls(), 0);
  }
);

test(
  "returns the previous Token ID for a failed credential",
  async () => {
    const env = createTestEnvironment([
      makeCredential(
        "DCR-2026-AAAA3333",
        "failed"
      ),
    ]);

    const response = await supertest(env.app)
      .post("/api/credentials/issue")
      .send(makePayload("DCR-2026-BBBB4444"));

    assert.equal(response.status, 409);
    assert.equal(response.body.duplicate, true);

    assert.equal(
      response.body.existingCredential.tokenId,
      "DCR-2026-AAAA3333"
    );

    assert.equal(
      response.body.existingCredential.blockchainStatus,
      "failed"
    );

    assert.equal(env.records.length, 1);
    assert.equal(env.getBlockchainCalls(), 0);
  }
);

test(
  "detects older records without an issuanceKey",
  async () => {
    const legacy = makeCredential(
      "DCR-2026-AAAA4444",
      "confirmed"
    );

    delete legacy.issuanceKey;

    const env = createTestEnvironment([legacy]);

    const response = await supertest(env.app)
      .post("/api/credentials/issue")
      .send(makePayload("DCR-2026-BBBB5555"));

    assert.equal(response.status, 409);
    assert.equal(response.body.duplicate, true);
    assert.equal(env.records.length, 1);
    assert.equal(env.getBlockchainCalls(), 0);
  }
);

test(
  "simultaneous identical credentials with different Token IDs produce one issuance",
  async () => {
    const env = createTestEnvironment();

    const [first, second] = await Promise.all([
      supertest(env.app)
        .post("/api/credentials/issue")
        .send(makePayload("DCR-2026-CCCC1111")),

      supertest(env.app)
        .post("/api/credentials/issue")
        .send(makePayload("DCR-2026-DDDD2222")),
    ]);

    const statuses = [
      first.status,
      second.status,
    ].sort();

    assert.deepEqual(statuses, [201, 409]);

    assert.equal(env.records.length, 1);
    assert.equal(env.getBlockchainCalls(), 1);

    assert.equal(
      env.records[0].issuanceKey,
      getIssuanceKey()
    );
  }
);

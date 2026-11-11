
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const {
  generateCredentialFingerprint,
} = require("../src/utils/credentialHash");

const WALLET =
  "0x000000000000000000000000000000000000dead";

const OTHER_WALLET =
  "0x000000000000000000000000000000000000beef";

const TX_HASH = "0x" + "a".repeat(64);

const DATA = {
  degreeId: "TEST-DEG-001",
  regNumber: "TEST2026001",
  holderName: "TEST STUDENT",
  degreeTitle: "B.Tech Computer Science",
  yearOfCompletion: "2026",
  issuer: "Demo University",
};

const FINGERPRINT =
  generateCredentialFingerprint("academic", DATA);

function makeCredential(overrides = {}) {
  return {
    _id: "test-credential-id",
    tokenId: "DCR-2026-TEST0001",
    documentType: "Academic Degree",
    documentTypeKey: "academic",
    data: { ...DATA },
    fingerprint: FINGERPRINT,
    issuerWalletAddress: WALLET,
    blockchainStatus: "failed",
    status: "active",
    ...overrides,
  };
}

function createEnvironment(options = {}) {
  const {
    credential = makeCredential(),
    authenticatedWallet = WALLET,
    blockchainRecord = {
      exists: false,
    },
    blockchainError = null,
    transactionStatus = {
      status: "not_found",
    },
    transactionError = null,
  } = options;

  const calls = {
    databaseReads: 0,
    databaseWrites: 0,
    blockchainReads: 0,
    transactionChecks: 0,
    registrations: 0,
  };

  const Credential = {
    findOne: async (query) => {
      calls.databaseReads++;

      if (!credential) {
        return null;
      }

      if (
        credential.tokenId !== query.tokenId ||
        credential.issuerWalletAddress.toLowerCase() !==
          query.issuerWalletAddress.toLowerCase()
      ) {
        return null;
      }

      return credential;
    },

    create: async () => {
      calls.databaseWrites++;
      throw new Error("Unexpected database write");
    },

    findOneAndUpdate: async () => {
      calls.databaseWrites++;
      throw new Error("Unexpected database write");
    },

    findByIdAndUpdate: async () => {
      calls.databaseWrites++;
      throw new Error("Unexpected database write");
    },

    updateOne: async () => {
      calls.databaseWrites++;
      throw new Error("Unexpected database write");
    },
  };

  function institutionAuthMiddleware(req, res, next) {
    req.institution = {
      id: "institution-test-id",
      institutionName: "Demo University",
      walletAddress: authenticatedWallet,
      role: "institution",
    };

    next();
  }

  const blockchainService = {
    getCredentialFromBlockchain: async () => {
      calls.blockchainReads++;

      if (blockchainError) {
        throw blockchainError;
      }

      return blockchainRecord;
    },

    checkTransactionStatus: async () => {
      calls.transactionChecks++;

      if (transactionError) {
        throw transactionError;
      }

      return transactionStatus;
    },

    registerCredentialOnBlockchain: async () => {
      calls.registrations++;
      throw new Error(
        "A real registration must not occur in recovery tests."
      );
    },
  };

  const router = proxyquire(
    "../src/routes/credentialRetryRoutes",
    {
      "../models/Credential": Credential,
      "../middleware/institutionAuthMiddleware":
        institutionAuthMiddleware,
      "../utils/credentialHash": {
        generateCredentialFingerprint,
      },
      "../services/blockchainService":
        blockchainService,
    }
  );

  const app = express();

  app.use(express.json());

  app.use("/api/credentials", router);

  return {
    app,
    calls,
  };
}

async function requestRecovery(env) {
  return supertest(env.app)
    .post(
      "/api/credentials/retry/DCR-2026-TEST0001"
    )
    .send({});
}

function assertNoWritesOrRegistrations(env) {
  assert.equal(env.calls.databaseWrites, 0);
  assert.equal(env.calls.registrations, 0);
}

test(
  "rejects credentials belonging to another institution",
  async () => {
    const env = createEnvironment({
      authenticatedWallet: OTHER_WALLET,
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);

    assert.equal(env.calls.blockchainReads, 0);
    assertNoWritesOrRegistrations(env);
  }
);

test(
  "rejects an already confirmed credential",
  async () => {
    const env = createEnvironment({
      credential: makeCredential({
        blockchainStatus: "confirmed",
      }),
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);
    assert.match(
      response.body.message,
      /already confirmed/i
    );

    assert.equal(env.calls.blockchainReads, 0);
    assertNoWritesOrRegistrations(env);
  }
);

test(
  "requires reconciliation for a pending credential",
  async () => {
    const env = createEnvironment({
      credential: makeCredential({
        blockchainStatus: "pending",
        transactionHash: TX_HASH,
      }),
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);

    assert.equal(
      response.body.reconciliationRequired,
      true
    );

    assert.equal(
      response.body.transactionHash,
      TX_HASH
    );

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "blocks automatic retry when no transaction hash was saved",
  async () => {
    const env = createEnvironment();

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);

    assert.equal(
      response.body.recoveryReason,
      "unknown_previous_submission"
    );

    assert.equal(response.body.retryAllowed, false);
    assert.equal(env.calls.blockchainReads, 1);

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "requires reconciliation if the credential already exists on-chain",
  async () => {
    const env = createEnvironment({
      blockchainRecord: {
        exists: true,
        fingerprint: "0x" + FINGERPRINT,
        issuer: WALLET,
        registeredAt: "100",
      },
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);

    assert.equal(
      response.body.onChainRecordMatches,
      true
    );

    assert.equal(
      response.body.reconciliationRequired,
      true
    );

    assert.equal(response.body.retryAllowed, false);

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "blocks recovery if the blockchain fingerprint differs",
  async () => {
    const env = createEnvironment({
      blockchainRecord: {
        exists: true,
        fingerprint: "0x" + "f".repeat(64),
        issuer: WALLET,
        registeredAt: "100",
      },
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);

    assert.equal(
      response.body.onChainRecordMatches,
      false
    );

    assert.equal(response.body.retryAllowed, false);

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "returns 503 without retrying when Polygon RPC times out",
  async () => {
    const env = createEnvironment({
      blockchainError: new Error(
        "server response 408 Request Timeout"
      ),
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 503);

    assert.equal(response.body.retryAllowed, false);

    assert.equal(env.calls.blockchainReads, 1);

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "rejects credential data with an incorrect stored fingerprint",
  async () => {
    const env = createEnvironment({
      credential: makeCredential({
        fingerprint: "f".repeat(64),
      }),
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);

    assert.match(
      response.body.message,
      /fingerprint/i
    );

    assert.equal(env.calls.blockchainReads, 0);

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "identifies a mined and failed transaction without resubmitting",
  async () => {
    const env = createEnvironment({
      credential: makeCredential({
        transactionHash: TX_HASH,
      }),
      transactionStatus: {
        status: "failed",
        blockNumber: 52500000,
      },
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);

    assert.equal(
      response.body.previousTransactionFailed,
      true
    );

    assert.equal(response.body.retryAllowed, false);

    assert.equal(env.calls.transactionChecks, 1);

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "blocks a pending previous transaction",
  async () => {
    const env = createEnvironment({
      credential: makeCredential({
        transactionHash: TX_HASH,
      }),
      transactionStatus: {
        status: "pending",
      },
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);

    assert.equal(response.body.retryAllowed, false);

    assert.equal(env.calls.transactionChecks, 1);

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "blocks recovery when the transaction RPC lookup fails",
  async () => {
    const env = createEnvironment({
      credential: makeCredential({
        transactionHash: TX_HASH,
      }),
      transactionError: new Error(
        "Transaction RPC unavailable"
      ),
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 503);

    assert.equal(response.body.retryAllowed, false);

    assert.equal(env.calls.transactionChecks, 1);

    assertNoWritesOrRegistrations(env);
  }
);

test(
  "blocks recovery for a revoked credential",
  async () => {
    const env = createEnvironment({
      credential: makeCredential({
        status: "revoked",
      }),
    });

    const response = await requestRecovery(env);

    assert.equal(response.status, 409);

    assert.equal(env.calls.blockchainReads, 0);

    assertNoWritesOrRegistrations(env);
  }
);


const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

const WALLET_A =
  "0x000000000000000000000000000000000000aaaa";

const WALLET_B =
  "0x000000000000000000000000000000000000bbbb";

function makeCredential(
  tokenId,
  wallet,
  blockchainStatus,
  date
) {
  return {
    tokenId,
    documentType: "Academic Degree",
    documentTypeKey: "academic",
    issuerWalletAddress: wallet,
    blockchainStatus,
    status: "active",
    issuedAt: new Date(date),
    createdAt: new Date(date),
    transactionHash:
      blockchainStatus === "confirmed"
        ? "0x" + "a".repeat(64)
        : undefined,
    blockNumber:
      blockchainStatus === "confirmed"
        ? 52516222
        : undefined,
  };
}

function createEnvironment(options = {}) {
  const records = options.records || [
    makeCredential(
      "DCR-A-001",
      WALLET_A,
      "confirmed",
      "2026-11-01"
    ),
    makeCredential(
      "DCR-A-002",
      WALLET_A,
      "failed",
      "2026-11-02"
    ),
    makeCredential(
      "DCR-A-003",
      WALLET_A,
      "pending",
      "2026-11-03"
    ),
    makeCredential(
      "DCR-B-001",
      WALLET_B,
      "confirmed",
      "2026-11-04"
    ),
  ];

  const calls = {
    reads: 0,
    writes: 0,
  };

  const Credential = {
    find(filter) {
      calls.reads++;

      let result = records.filter(
        (record) =>
          record.issuerWalletAddress ===
          filter.issuerWalletAddress
      );

      const query = {
        select() {
          return this;
        },

        sort() {
          result = [...result].sort(
            (a, b) =>
              b.createdAt - a.createdAt
          );

          return this;
        },

        skip(count) {
          result = result.slice(count);
          return this;
        },

        limit(count) {
          result = result.slice(0, count);
          return this;
        },

        async lean() {
          return result;
        },
      };

      return query;
    },

    async countDocuments(filter) {
      calls.reads++;

      return records.filter((record) => {
        if (
          record.issuerWalletAddress !==
          filter.issuerWalletAddress
        ) {
          return false;
        }

        if (
          filter.blockchainStatus &&
          record.blockchainStatus !==
            filter.blockchainStatus
        ) {
          return false;
        }

        return true;
      }).length;
    },

    async create() {
      calls.writes++;
      throw new Error(
        "Dashboard must not create credentials."
      );
    },

    async updateOne() {
      calls.writes++;
      throw new Error(
        "Dashboard must not modify credentials."
      );
    },
  };

  function institutionAuthMiddleware(
    req,
    res,
    next
  ) {
    if (
      req.headers.authorization !==
      "Bearer valid-test-token"
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    req.institution = {
      institutionName: "Demo University",
      walletAddress:
        options.wallet || WALLET_A,
      role: "institution",
    };

    next();
  }

  const router = proxyquire(
    "../src/routes/institutionCredentialRoutes",
    {
      "../models/Credential": Credential,
      "../middleware/institutionAuthMiddleware":
        institutionAuthMiddleware,
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

function getCredentials(env, page = 1) {
  return supertest(env.app)
    .get(
      `/api/credentials/mine?page=${page}`
    )
    .set(
      "Authorization",
      "Bearer valid-test-token"
    );
}

test(
  "rejects requests without institution authentication",
  async () => {
    const env = createEnvironment();

    const response = await supertest(
      env.app
    ).get("/api/credentials/mine");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(env.calls.reads, 0);
  }
);

test(
  "returns only credentials belonging to the logged-in institution",
  async () => {
    const env = createEnvironment();

    const response =
      await getCredentials(env);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.total, 3);

    const tokenIds =
      response.body.credentials.map(
        (credential) => credential.tokenId
      );

    assert.deepEqual(
      tokenIds,
      [
        "DCR-A-003",
        "DCR-A-002",
        "DCR-A-001",
      ]
    );

    assert.equal(
      tokenIds.includes("DCR-B-001"),
      false
    );

    assert.equal(env.calls.writes, 0);
  }
);

test(
  "calculates credential statistics correctly",
  async () => {
    const env = createEnvironment();

    const response =
      await getCredentials(env);

    assert.deepEqual(
      response.body.summary,
      {
        total: 3,
        confirmed: 1,
        pending: 1,
        failed: 1,
        notRegistered: 0,
      }
    );
  }
);

test(
  "keeps credentials isolated between institutions",
  async () => {
    const env = createEnvironment({
      wallet: WALLET_B,
    });

    const response =
      await getCredentials(env);

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 1);

    assert.equal(
      response.body.credentials[0].tokenId,
      "DCR-B-001"
    );

    assert.equal(
      response.body.summary.confirmed,
      1
    );
  }
);

test(
  "does not expose private credential data in the listing",
  async () => {
    const env = createEnvironment();

    const response =
      await getCredentials(env);

    const credential =
      response.body.credentials[0];

    assert.equal(
      credential.data,
      undefined
    );

    assert.equal(
      credential.fingerprint,
      undefined
    );

    assert.equal(
      credential.issuerWalletAddress,
      undefined
    );
  }
);

test(
  "returns an empty history for a new institution",
  async () => {
    const env = createEnvironment({
      records: [],
    });

    const response =
      await getCredentials(env);

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 0);

    assert.deepEqual(
      response.body.credentials,
      []
    );

    assert.equal(
      response.body.summary.confirmed,
      0
    );
  }
);

test(
  "supports pagination",
  async () => {
    const records = Array.from(
      { length: 25 },
      (_, index) =>
        makeCredential(
          `DCR-A-${String(index + 1).padStart(3, "0")}`,
          WALLET_A,
          "confirmed",
          new Date(
            Date.UTC(
              2026,
              10,
              1 + index
            )
          ).toISOString()
        )
    );

    const env = createEnvironment({
      records,
    });

    const first =
      await getCredentials(env, 1);

    const second =
      await getCredentials(env, 2);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);

    assert.equal(
      first.body.credentials.length,
      20
    );

    assert.equal(
      second.body.credentials.length,
      5
    );

    assert.equal(first.body.total, 25);
    assert.equal(first.body.totalPages, 2);
    assert.equal(second.body.page, 2);
  }
);

test(
  "does not modify credentials when retrieving history",
  async () => {
    const env = createEnvironment();

    await getCredentials(env);

    assert.equal(env.calls.writes, 0);
  }
);

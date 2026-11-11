
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const jwt = require("jsonwebtoken");
const proxyquire = require("proxyquire").noCallThru();

process.env.JWT_SECRET = "docuverify-local-test-secret";

const SECRET = process.env.JWT_SECRET;

const INSTITUTION_ID = "691000000000000000000001";
const ADMIN_ID = "691000000000000000000002";

const INSTITUTION_WALLET =
  "0x000000000000000000000000000000000000dead";

const TOKEN_ID = "DV-SECURITY-TEST-001";

function createToken(payload, options = {}) {
  return jwt.sign(payload, SECRET, options);
}

function createApp(middleware) {
  const app = express();
  app.use(express.json());

  app.get("/protected", middleware, (req, res) => {
    res.status(200).json({
      success: true,
      institution: req.institution || null,
      admin: req.admin || null,
    });
  });

  return app;
}

function loadInstitutionMiddleware(institution) {
  return proxyquire(
    "../src/middleware/institutionAuthMiddleware",
    {
      "../models/Institution": {
        findById: async () => institution,
      },
    }
  );
}

function loadAdminMiddleware(admin) {
  return proxyquire(
    "../src/middleware/authMiddleware",
    {
      "../models/Admin": {
        findById: async () => admin,
      },
    }
  );
}

// ======================================================
// INSTITUTION AUTHENTICATION MIDDLEWARE
// ======================================================

test("blocks institution access without an authorization header", async () => {
  const middleware = loadInstitutionMiddleware(null);
  const response = await supertest(createApp(middleware))
    .get("/protected");

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Authentication required. Please log in."
  );
});

test("rejects an invalid institution JWT", async () => {
  const middleware = loadInstitutionMiddleware(null);

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", "Bearer invalid-token");

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Invalid or expired authentication token."
  );
});

test("rejects an expired institution JWT", async () => {
  const middleware = loadInstitutionMiddleware(null);

  const token = createToken(
    {
      id: INSTITUTION_ID,
      role: "institution",
    },
    { expiresIn: -1 }
  );

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 401);
  assert.equal(
    response.body.message,
    "Invalid or expired authentication token."
  );
});

test("rejects a JWT with the wrong role for institution access", async () => {
  const middleware = loadInstitutionMiddleware(null);

  const token = createToken({
    id: ADMIN_ID,
    role: "platform_admin",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 403);
  assert.equal(
    response.body.message,
    "Institution privileges required."
  );
});

test("blocks a pending institution from protected routes", async () => {
  const middleware = loadInstitutionMiddleware({
    _id: INSTITUTION_ID,
    institutionName: "Demo University",
    officialEmail: "demo@example.com",
    walletAddress: INSTITUTION_WALLET,
    isActive: true,
    applicationStatus: "pending",
  });

  const token = createToken({
    id: INSTITUTION_ID,
    role: "institution",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 403);
  assert.equal(
    response.body.message,
    "Your institution must be approved before issuing credentials."
  );
});

test("blocks a rejected institution from protected routes", async () => {
  const middleware = loadInstitutionMiddleware({
    _id: INSTITUTION_ID,
    institutionName: "Demo University",
    officialEmail: "demo@example.com",
    walletAddress: INSTITUTION_WALLET,
    isActive: true,
    applicationStatus: "rejected",
  });

  const token = createToken({
    id: INSTITUTION_ID,
    role: "institution",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 403);
});

test("blocks an inactive institution", async () => {
  const middleware = loadInstitutionMiddleware({
    _id: INSTITUTION_ID,
    isActive: false,
    applicationStatus: "approved",
  });

  const token = createToken({
    id: INSTITUTION_ID,
    role: "institution",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 401);
  assert.equal(
    response.body.message,
    "Institution account is invalid or inactive."
  );
});

test("blocks access when the institution no longer exists", async () => {
  const middleware = loadInstitutionMiddleware(null);

  const token = createToken({
    id: INSTITUTION_ID,
    role: "institution",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 401);
});

test("allows an approved and active institution", async () => {
  const middleware = loadInstitutionMiddleware({
    _id: INSTITUTION_ID,
    institutionName: "Demo University",
    officialEmail: "demo@example.com",
    walletAddress: INSTITUTION_WALLET,
    isActive: true,
    applicationStatus: "approved",
  });

  const token = createToken({
    id: INSTITUTION_ID,
    role: "institution",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.institution.walletAddress,
    INSTITUTION_WALLET
  );
});

// ======================================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ======================================================

test("rejects an admin request without a JWT", async () => {
  const middleware = loadAdminMiddleware(null);

  const response = await supertest(createApp(middleware))
    .get("/protected");

  assert.equal(response.status, 401);
});

test("rejects an institution JWT on an admin-only route", async () => {
  const middleware = loadAdminMiddleware(null);

  const token = createToken({
    id: INSTITUTION_ID,
    role: "institution",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 403);
  assert.equal(
    response.body.message,
    "Access denied. Administrator privileges required."
  );
});

test("blocks an inactive administrator", async () => {
  const middleware = loadAdminMiddleware({
    _id: ADMIN_ID,
    name: "Test Admin",
    email: "admin@example.com",
    role: "platform_admin",
    isActive: false,
  });

  const token = createToken({
    id: ADMIN_ID,
    role: "platform_admin",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 401);
  assert.equal(
    response.body.message,
    "Administrator account is invalid or inactive."
  );
});

test("allows a valid active platform administrator", async () => {
  const middleware = loadAdminMiddleware({
    _id: ADMIN_ID,
    name: "Test Admin",
    email: "admin@example.com",
    role: "platform_admin",
    isActive: true,
  });

  const token = createToken({
    id: ADMIN_ID,
    role: "platform_admin",
  });

  const response = await supertest(createApp(middleware))
    .get("/protected")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.admin.role,
    "platform_admin"
  );
});

// ======================================================
// INSTITUTION LOGIN ROUTES
// ======================================================

function createInstitutionRoutes(Institution, bcryptMock) {
  return proxyquire(
    "../src/routes/institutionRoutes",
    {
      "../models/Institution": Institution,

      "../middleware/authMiddleware": (
        req, res, next
      ) => next(),

      bcrypt: bcryptMock,
    }
  );
}

test("institution login rejects missing fields", async () => {
  const Institution = {
    findOne: async () => {
      throw new Error("Database should not be queried");
    },
  };

  const bcryptMock = {
    compare: async () => false,
    hash: async () => "test-hash",
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api/institutions",
    createInstitutionRoutes(Institution, bcryptMock)
  );

  const response = await supertest(app)
    .post("/api/institutions/login")
    .send({
      officialEmail: "demo@example.com",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
});

test("institution login rejects an unknown email", async () => {
  const Institution = {
    findOne: () => ({
      select: async () => null,
    }),
  };

  const bcryptMock = {
    compare: async () => false,
    hash: async () => "test-hash",
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api/institutions",
    createInstitutionRoutes(Institution, bcryptMock)
  );

  const response = await supertest(app)
    .post("/api/institutions/login")
    .send({
      officialEmail: "unknown@example.com",
      password: "Password123",
    });

  assert.equal(response.status, 401);
  assert.equal(
    response.body.message,
    "Invalid email or password."
  );
});

test("institution login rejects an incorrect password", async () => {
  const institution = {
    _id: INSTITUTION_ID,
    password: "stored-hash",
    isActive: true,
    applicationStatus: "approved",
  };

  const Institution = {
    findOne: () => ({
      select: async () => institution,
    }),
  };

  const bcryptMock = {
    compare: async () => false,
    hash: async () => "test-hash",
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api/institutions",
    createInstitutionRoutes(Institution, bcryptMock)
  );

  const response = await supertest(app)
    .post("/api/institutions/login")
    .send({
      officialEmail: "demo@example.com",
      password: "WrongPassword",
    });

  assert.equal(response.status, 401);
});

test("institution login blocks an inactive account", async () => {
  const institution = {
    _id: INSTITUTION_ID,
    password: "stored-hash",
    isActive: false,
    applicationStatus: "approved",
  };

  const Institution = {
    findOne: () => ({
      select: async () => institution,
    }),
  };

  const bcryptMock = {
    compare: async () => true,
    hash: async () => "test-hash",
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api/institutions",
    createInstitutionRoutes(Institution, bcryptMock)
  );

  const response = await supertest(app)
    .post("/api/institutions/login")
    .send({
      officialEmail: "demo@example.com",
      password: "Password123",
    });

  assert.equal(response.status, 403);
  assert.equal(
    response.body.message,
    "This institution account is inactive."
  );
});

test("institution login succeeds and returns an institution JWT", async () => {
  const institution = {
    _id: INSTITUTION_ID,
    institutionName: "Demo University",
    officialEmail: "demo@example.com",
    walletAddress: INSTITUTION_WALLET,
    password: "stored-hash",
    isActive: true,
    applicationStatus: "approved",
  };

  const Institution = {
    findOne: (query) => {
      assert.equal(
        query.officialEmail,
        "demo@example.com"
      );

      return {
        select: async (fields) => {
          assert.equal(fields, "+password");
          return institution;
        },
      };
    },
  };

  const bcryptMock = {
    compare: async () => true,
    hash: async () => "test-hash",
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api/institutions",
    createInstitutionRoutes(Institution, bcryptMock)
  );

  const response = await supertest(app)
    .post("/api/institutions/login")
    .send({
      officialEmail: " DEMO@EXAMPLE.COM ",
      password: "Password123",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.token);

  const decoded = jwt.verify(response.body.token, SECRET);

  assert.equal(decoded.id, INSTITUTION_ID);
  assert.equal(decoded.role, "institution");

  assert.equal(
    response.body.institution.applicationStatus,
    "approved"
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      response.body.institution,
      "password"
    ),
    false
  );
});

// ======================================================
// INSTITUTION REGISTRATION VALIDATION
// ======================================================

const validRegistration = {
  institutionName: "Demo University",
  officialWebsite: "https://example.com",
  officialEmail: "demo@example.com",
  password: "Password123",
  registrationDetails: "Registered educational institution",
  walletAddress: INSTITUTION_WALLET,
};

function createRegistrationApp(Institution, bcryptMock) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/institutions",
    createInstitutionRoutes(Institution, bcryptMock)
  );
  return app;
}

test("registration rejects a weak password", async () => {
  const Institution = {
    findOne: async () => null,
  };

  const bcryptMock = {
    hash: async () => "test-hash",
    compare: async () => false,
  };

  const response = await supertest(
    createRegistrationApp(Institution, bcryptMock)
  )
    .post("/api/institutions/register")
    .send({
      ...validRegistration,
      password: "short",
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    "Password must contain at least 8 characters."
  );
});

test("registration rejects an invalid email address", async () => {
  const Institution = {
    findOne: async () => null,
  };

  const bcryptMock = {
    hash: async () => "test-hash",
    compare: async () => false,
  };

  const response = await supertest(
    createRegistrationApp(Institution, bcryptMock)
  )
    .post("/api/institutions/register")
    .send({
      ...validRegistration,
      officialEmail: "not-an-email",
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    "Please provide a valid institutional email address."
  );
});

test("registration rejects an invalid website URL", async () => {
  const Institution = {
    findOne: async () => null,
  };

  const bcryptMock = {
    hash: async () => "test-hash",
    compare: async () => false,
  };

  const response = await supertest(
    createRegistrationApp(Institution, bcryptMock)
  )
    .post("/api/institutions/register")
    .send({
      ...validRegistration,
      officialWebsite: "javascript:alert(1)",
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    "Please provide a valid institution website URL."
  );
});

test("registration rejects an invalid wallet address", async () => {
  const Institution = {
    findOne: async () => null,
  };

  const bcryptMock = {
    hash: async () => "test-hash",
    compare: async () => false,
  };

  const response = await supertest(
    createRegistrationApp(Institution, bcryptMock)
  )
    .post("/api/institutions/register")
    .send({
      ...validRegistration,
      walletAddress: "invalid-wallet",
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    "Please provide a valid wallet address."
  );
});

test("registration rejects an already registered email or wallet", async () => {
  const Institution = {
    findOne: async () => ({
      _id: INSTITUTION_ID,
    }),
  };

  const bcryptMock = {
    hash: async () => "test-hash",
    compare: async () => false,
  };

  const response = await supertest(
    createRegistrationApp(Institution, bcryptMock)
  )
    .post("/api/institutions/register")
    .send(validRegistration);

  assert.equal(response.status, 409);
});

// ======================================================
// ADMIN LOGIN ROUTE
// ======================================================

test("admin login rejects an incorrect password", async () => {
  const Admin = {
    findOne: () => ({
      select: async () => ({
        _id: ADMIN_ID,
        name: "Test Admin",
        email: "admin@example.com",
        password: "stored-hash",
        isActive: true,
        role: "platform_admin",
      }),
    }),
  };

  const routes = proxyquire(
    "../src/routes/adminRoutes",
    {
      "../models/Admin": Admin,

      "bcryptjs": {
        compare: async () => false,
      },
    }
  );

  const app = express();
  app.use(express.json());
  app.use("/api/admin", routes);

  const response = await supertest(app)
    .post("/api/admin/login")
    .send({
      email: "admin@example.com",
      password: "WrongPassword",
    });

  assert.equal(response.status, 401);
  assert.equal(
    response.body.message,
    "Invalid email or password."
  );
});

// ======================================================
// CROSS-INSTITUTION CREDENTIAL ACCESS
// ======================================================

test("institution cannot reconcile another institution's credential", async () => {
  let capturedQuery;

  const Credential = {
    findOne: async (query) => {
      capturedQuery = query;
      return null;
    },
  };

  const routes = proxyquire(
    "../src/routes/credentialRoutes",
    {
      "../models/Credential": Credential,

      "../utils/credentialHash": {
        generateCredentialFingerprint: () => "a".repeat(64),
      },

      "../middleware/institutionAuthMiddleware": (
        req, res, next
      ) => {
        req.institution = {
          id: INSTITUTION_ID,
          institutionName: "Institution A",
          walletAddress: INSTITUTION_WALLET,
        };

        next();
      },

      "../services/blockchainService": {
        registerCredentialOnBlockchain: async () => {
          throw new Error("Should not be called");
        },
        getCredentialFromBlockchain: async () => null,
        checkTransactionStatus: async () => ({
          status: "not_found",
        }),
        getPlatformWalletAddress: async () => INSTITUTION_WALLET,
      },
    }
  );

  const app = express();
  app.use(express.json());
  app.use("/api/credentials", routes);

  const response = await supertest(app)
    .post(`/api/credentials/reconcile/${TOKEN_ID}`)
    .send({});

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);

  assert.deepEqual(capturedQuery, {
    tokenId: TOKEN_ID,
    issuerWalletAddress: INSTITUTION_WALLET,
  });
});

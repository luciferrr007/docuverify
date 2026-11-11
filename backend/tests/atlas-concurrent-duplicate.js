
require("dotenv").config();

const mongoose = require("mongoose");
const Credential = require("../src/models/Credential");

const API_URL = "http://localhost:5000/api/credentials/issue";

// Read JWT from environment variable instead of hardcoding it.
const INSTITUTION_JWT = process.env.INSTITUTION_JWT?.trim();

const tokenId = `DV-ATLAS-RACE-${Date.now()}`;

const credentialData = {
  degreeId: "DEG-2026-001",
  regNumber: "TEST-REG-001",
  holderName: "Test Student",
  degreeTitle: "Bachelor of Technology",
  yearOfCompletion: "2026",
  issuer: "DEMO UNIVERSITY",
};

const requestBody = {
  tokenId,
  documentType: "Academic Certificate",
  documentTypeKey: "academic",
  data: credentialData,
  fingerprint:
    "d1d04d282f010308aa2be0c3a611a41725daae72a04ed7ac6fca71e56ed77d42",
  issuedAt: "2026-11-09T10:00:00.000Z",
};

// ==========================================
// JWT DIAGNOSTICS
// ==========================================

function diagnoseJWT() {
  console.log("\n========== JWT DIAGNOSTIC ==========");

  if (!INSTITUTION_JWT) {
    console.log("Token provided: NO");
    console.log("Set the INSTITUTION_JWT environment variable.");
    return false;
  }

  const parts = INSTITUTION_JWT.split(".");

  console.log("Token provided: YES");
  console.log("Token length:", INSTITUTION_JWT.length);
  console.log("JWT structure valid:", parts.length === 3);

  if (parts.length !== 3) {
    console.log("Problem: JWT must contain three parts.");
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    const expired = payload.exp
      ? Date.now() >= payload.exp * 1000
      : false;

    console.log("Institution ID:", payload.id || "Missing");
    console.log("Role:", payload.role || "Missing");

    console.log(
      "Expires at:",
      payload.exp
        ? new Date(payload.exp * 1000).toISOString()
        : "Missing"
    );

    console.log("Expired:", expired);

    if (expired) {
      console.log("Problem: JWT has expired.");
      return false;
    }

    if (payload.role !== "institution" || !payload.id) {
      console.log("Problem: Required institution claims are missing.");
      return false;
    }

    return true;
  } catch (error) {
    console.log("JWT decoding failed:", error.message);
    return false;
  }
}

// ==========================================
// SEND ISSUE REQUEST
// ==========================================

async function sendIssueRequest(requestName) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTITUTION_JWT}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseBody = await response.json();

  console.log(`\n${requestName}: HTTP ${response.status}`);
  console.log("Response:", responseBody);

  return {
    status: response.status,
    body: responseBody,
  };
}

// ==========================================
// RUN ATLAS CONCURRENCY TEST
// ==========================================

async function runTest() {
  try {
    if (!diagnoseJWT()) {
      throw new Error("JWT diagnostic failed. Test stopped.");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("\nConnected to MongoDB Atlas.");
    console.log("Test Token ID:", tokenId);

    const existing = await Credential.findOne({ tokenId });

    if (existing) {
      throw new Error("Token ID already exists. Test stopped.");
    }

    console.log("\nSending two requests simultaneously...");

    const results = await Promise.all([
      sendIssueRequest("Request A"),
      sendIssueRequest("Request B"),
    ]);

    const successfulRequests = results.filter(
      (result) => result.status === 201
    ).length;

    const duplicateRequests = results.filter(
      (result) => result.status === 409
    ).length;

    const unauthorizedRequests = results.filter(
      (result) => result.status === 401
    ).length;

    const savedCredential = await Credential.findOne({ tokenId });

    console.log("\n========== FINAL RESULTS ==========");

    console.log("Successful requests:", successfulRequests);
    console.log("Duplicate responses:", duplicateRequests);
    console.log("Unauthorized responses:", unauthorizedRequests);

    console.log(
      "Credential exists in Atlas:",
      Boolean(savedCredential)
    );

    console.log(
      "Blockchain status:",
      savedCredential?.blockchainStatus || "No record"
    );

    console.log(
      "Transaction hash:",
      savedCredential?.transactionHash || "Not available"
    );

    if (
      successfulRequests === 1 &&
      duplicateRequests === 1 &&
      savedCredential
    ) {
      console.log("\nPASS: Atlas concurrency test succeeded.");
    } else if (unauthorizedRequests > 0) {
      console.log("\nAUTHENTICATION FAILED.");
    } else {
      console.log("\nFAIL: Expected one 201 and one 409 response.");
    }
  } catch (error) {
    console.error("\nTest error:", error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runTest();


const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  getRevertedReceipt
} = require("../src/services/blockchainService");

// Test 1: Detect a transaction that was mined but reverted.

test("detects a mined and reverted transaction", () => {
  const error = {
    receipt: {
      status: 0,
      blockNumber: 52350000
    }
  };

  const result = getRevertedReceipt(error);

  assert.deepEqual(result, {
    status: 0,
    blockNumber: 52350000
  });
});

// Test 2: Detect a failed receipt inside error.info.

test("detects a reverted transaction inside error.info", () => {
  const error = {
    info: {
      receipt: {
        status: 0,
        blockNumber: 52350001
      }
    }
  };

  const result = getRevertedReceipt(error);

  assert.deepEqual(result, {
    status: 0,
    blockNumber: 52350001
  });
});

// Test 3: Do not classify a successful transaction as reverted.

test("does not classify a successful transaction as reverted", () => {
  const error = {
    receipt: {
      status: 1,
      blockNumber: 52350002
    }
  };

  const result = getRevertedReceipt(error);

  assert.equal(result, null);
});

// Test 4: Handle errors without a transaction receipt.

test("returns null when no receipt is available", () => {
  const error = new Error("Network connection failed");

  const result = getRevertedReceipt(error);

  assert.equal(result, null);
});

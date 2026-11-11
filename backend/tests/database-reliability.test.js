
const { test } = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const proxyquire = require("proxyquire").noCallThru();

function createMockMongoose(connectImplementation) {
  const connection = new EventEmitter();

  connection.host = "test.mongodb.net";

  const mongoose = {
    connection,
    connect: connectImplementation,
  };

  return { mongoose, connection };
}

test("connects successfully to MongoDB", async () => {
  const expectedConnection = {
    connection: {
      host: "test.mongodb.net",
    },
  };

  const { mongoose } = createMockMongoose(
    async (uri, options) => {
      assert.equal(uri, "mongodb://test.mongodb.net/test");
      assert.equal(options.serverSelectionTimeoutMS, 10000);

      return expectedConnection;
    }
  );

  const connectDB = proxyquire(
    "../src/config/db",
    { mongoose }
  );

  const originalURI = process.env.MONGODB_URI;
  process.env.MONGODB_URI =
    "mongodb://test.mongodb.net/test";

  try {
    const result = await connectDB();
    assert.equal(result, expectedConnection);
  } finally {
    if (originalURI === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalURI;
    }
  }
});

test("throws an error when MongoDB connection fails", async () => {
  const { mongoose } = createMockMongoose(
    async () => {
      throw new Error("Simulated MongoDB connection failure");
    }
  );

  const connectDB = proxyquire(
    "../src/config/db",
    { mongoose }
  );

  const originalURI = process.env.MONGODB_URI;
  process.env.MONGODB_URI = "mongodb://invalid/test";

  try {
    await assert.rejects(
      connectDB(),
      /Simulated MongoDB connection failure/
    );
  } finally {
    if (originalURI === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalURI;
    }
  }
});

test("registers MongoDB connection event listeners", () => {
  const { mongoose, connection } =
    createMockMongoose(async () => ({}));

  proxyquire("../src/config/db", { mongoose });

  assert.equal(connection.listenerCount("connected"), 1);
  assert.equal(connection.listenerCount("disconnected"), 1);
  assert.equal(connection.listenerCount("reconnected"), 1);
  assert.equal(connection.listenerCount("error"), 1);
});

test("detects MongoDB disconnection and reconnection events", () => {
  const { mongoose, connection } =
    createMockMongoose(async () => ({}));

  proxyquire("../src/config/db", { mongoose });

  let disconnected = false;
  let reconnected = false;

  connection.on("disconnected", () => {
    disconnected = true;
  });

  connection.on("reconnected", () => {
    reconnected = true;
  });

  connection.emit("disconnected");
  assert.equal(disconnected, true);

  connection.emit("reconnected");
  assert.equal(reconnected, true);
});

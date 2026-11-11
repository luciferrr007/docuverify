
const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

test("starts server only after successful MongoDB connection", async () => {
  let databaseConnected = false;

  const { app, startServer } = proxyquire(
    "../src/server",
    {
      "./config/db": async () => {
        databaseConnected = true;
      },
    }
  );

  const server = await startServer(0);

  try {
    assert.equal(databaseConnected, true);
    assert.equal(server.listening, true);
    assert.ok(app);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

test("does not start server when initial MongoDB connection fails", async () => {
  let databaseConnected = false;

  const { startServer } = proxyquire(
    "../src/server",
    {
      "./config/db": async () => {
        databaseConnected = true;

        throw new Error(
          "Simulated MongoDB startup failure"
        );
      },
    }
  );

  await assert.rejects(
    startServer(0),
    /Simulated MongoDB startup failure/
  );

  assert.equal(databaseConnected, true);
});

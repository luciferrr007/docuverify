
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "DocuVerify Backend is running!",
  });
});

app.use(
  "/api/credentials",
  require("./routes/institutionCredentialRoutes")
);

app.use(
  "/api/credentials",
  require("./routes/credentialRoutes")
);

app.use(
  "/api/credentials",
  require("./routes/credentialRetryRoutes")
);

app.use(
  "/api/institutions",
  require("./routes/institutionRoutes")
);

app.use(
  "/api/admin",
  require("./routes/adminRoutes")
);

app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed.",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large.",
    });
  }

  console.error("Server error:", err);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async (port = PORT) => {
  try {
    await connectDB();

    const server = app.listen(port, () => {
      console.log(
        `DocuVerify server running on port ${port}`
      );
    });

    return server;
  } catch (error) {
    console.error(
      "Server startup failed:",
      error.message
    );

    throw error;
  }
};

if (require.main === module) {
  startServer().catch(() => {
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
};

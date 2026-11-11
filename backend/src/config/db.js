
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(
      process.env.MONGODB_URI,
      {
        serverSelectionTimeoutMS: 10000,
      }
    );

    console.log(
      `MongoDB Connected: ${connection.connection.host}`
    );

    return connection;
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    throw error;
  }
};

// Monitor MongoDB connection events

mongoose.connection.on("connected", () => {
  console.log("MongoDB connection established.");
});

mongoose.connection.on("disconnected", () => {
  console.warn(
    "MongoDB disconnected. Mongoose will attempt to reconnect."
  );
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB successfully reconnected.");
});

mongoose.connection.on("error", (error) => {
  console.error(
    "MongoDB connection error:",
    error.message
  );
});

module.exports = connectDB;

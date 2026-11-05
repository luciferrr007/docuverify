const mongoose = require("mongoose");

const credentialSchema = new mongoose.Schema(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    documentType: {
      type: String,
      required: true,
      trim: true,
    },

    documentTypeKey: {
      type: String,
      required: true,
      enum: ["academic", "license", "government"],
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    fingerprint: {
      type: String,
      required: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
    },

    issuedAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Credential", credentialSchema);

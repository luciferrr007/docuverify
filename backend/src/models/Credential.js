
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

    issuanceKey: {
      type: String,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
    },

    issuedAt: {
      type: Date,
      required: true,
    },

    issuerName: {
      type: String,
      trim: true,
    },

    issuerWalletAddress: {
      type: String,
      lowercase: true,
      match: /^0x[a-f0-9]{40}$/,
    },

    blockchainStatus: {
      type: String,
      enum: [
        "not_registered",
        "pending",
        "confirmed",
        "failed",
      ],
      default: "not_registered",
    },

    transactionHash: {
      type: String,
      lowercase: true,
      match: /^0x[a-f0-9]{64}$/,
    },

    transactionNonce: {
      type: Number,
    },

    transactionChainId: {
      type: String,
    },

    transactionSubmittedAt: {
      type: Date,
    },

    blockNumber: {
      type: Number,
    },

    contractAddress: {
      type: String,
      lowercase: true,
      match: /^0x[a-f0-9]{40}$/,
    },

    blockchainNetwork: {
      type: String,
      enum: ["polygon-amoy"],
    },

    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

credentialSchema.index(
  { issuanceKey: 1 },
  {
    unique: true,
    name: "unique_issuance_key",
    partialFilterExpression: {
      issuanceKey: {
        $type: "string",
      },
    },
  }
);

module.exports = mongoose.model(
  "Credential",
  credentialSchema
);

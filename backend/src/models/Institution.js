
const mongoose = require("mongoose");

const institutionSchema = new mongoose.Schema(
  {
    institutionName: {
      type: String,
      required: true,
      trim: true,
    },

    officialWebsite: {
      type: String,
      required: true,
      trim: true,
    },

    officialEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    registrationDetails: {
      type: String,
      required: true,
      trim: true,
    },

    walletAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^0x[a-f0-9]{40}$/,
    },

    verificationDocuments: [
      {
        documentName: {
          type: String,
          trim: true,
        },
        documentUrl: {
          type: String,
          trim: true,
        },
      },
    ],

    applicationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Institution", institutionSchema);

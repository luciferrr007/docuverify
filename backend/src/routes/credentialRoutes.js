const express = require("express");
const router = express.Router();

const Credential = require("../models/Credential");

const { generateCredentialFingerprint } = require("../utils/credentialHash");

// ISSUE A NEW CREDENTIAL
router.post("/issue", async (req, res) => {
  try {
    const { tokenId, documentType, documentTypeKey, data, fingerprint, issuedAt } = req.body;

    // Check required fields
    if (
      !tokenId ||
      !documentType ||
      !documentTypeKey ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !fingerprint ||
      !issuedAt
    ) {
      return res.status(400).json({
        success: false,
        message: "All credential fields are required.",
      });
    }

    // Validate fingerprint format
    if (!/^[a-fA-F0-9]{64}$/.test(fingerprint)) {
      return res.status(400).json({
        success: false,
        message: "Invalid SHA-256 fingerprint format.",
      });
    }

    // Generate fingerprint independently on the backend
    let calculatedFingerprint;

    try {
      calculatedFingerprint = generateCredentialFingerprint(documentTypeKey, data);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Compare frontend and backend fingerprints
    if (calculatedFingerprint !== fingerprint.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Fingerprint mismatch. Credential data integrity check failed.",
      });
    }

    // Check whether Token ID already exists
    const existingCredential = await Credential.findOne({ tokenId });

    if (existingCredential) {
      return res.status(409).json({
        success: false,
        message: "A credential with this Token ID already exists.",
      });
    }

    // Save credential only after successful hash validation
    const credential = await Credential.create({
      tokenId,
      documentType,
      documentTypeKey,
      data,
      fingerprint: calculatedFingerprint,
      issuedAt,
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Credential issued successfully. Fingerprint validated.",
      credential,
    });
  } catch (error) {
    console.error("Issue credential error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to issue credential.",
    });
  }
});

// VERIFY A CREDENTIAL USING TOKEN ID
router.get("/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;

    const credential = await Credential.findOne({ tokenId });

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found.",
      });
    }

    // Recalculate fingerprint using the stored credential data
    let calculatedFingerprint;

    try {
      calculatedFingerprint = generateCredentialFingerprint(
        credential.documentTypeKey,
        credential.data,
      );
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to validate credential data.",
      });
    }

    // Compare recalculated and stored fingerprints
    const integrityValid = calculatedFingerprint === credential.fingerprint;

    const isValid = integrityValid && credential.status === "active";

    return res.status(200).json({
      success: true,
      message: isValid
        ? "Credential is authentic and active."
        : !integrityValid
          ? "Credential data integrity check failed."
          : "Credential has been revoked.",

      verification: {
        credentialExists: true,
        integrityValid,
        status: credential.status,
        isValid,
      },

      credential,
    });
  } catch (error) {
    console.error("Verify credential error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify credential.",
    });
  }
});

module.exports = router;

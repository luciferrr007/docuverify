
const express = require("express");

const router = express.Router();

const Credential = require("../models/Credential");

const institutionAuthMiddleware = require(
  "../middleware/institutionAuthMiddleware"
);

const {
  generateCredentialFingerprint,
} = require("../utils/credentialHash");

const {
  getCredentialFromBlockchain,
  checkTransactionStatus,
} = require("../services/blockchainService");

function normalizeHash(value) {
  return String(value || "")
    .replace(/^0x/i, "")
    .toLowerCase();
}

function respond(res, status, data) {
  return res.status(status).json({
    success: false,
    ...data,
  });
}

router.post(
  "/retry/:tokenId",
  institutionAuthMiddleware,
  async (req, res) => {
    const tokenId = String(
      req.params.tokenId || ""
    ).trim();

    const institutionWallet = String(
      req.institution.walletAddress || ""
    ).toLowerCase();

    try {
      const credential = await Credential.findOne({
        tokenId,
        issuerWalletAddress: institutionWallet,
      });

      if (!credential) {
        return respond(res, 404, {
          message:
            "Credential not found for this institution.",
        });
      }

      if (credential.status !== "active") {
        return respond(res, 409, {
          message:
            "Only active credentials can be recovered.",
          tokenId,
          blockchainStatus:
            credential.blockchainStatus,
        });
      }

      let calculatedHash;

      try {
        calculatedHash =
          generateCredentialFingerprint(
            credential.documentTypeKey,
            credential.data
          );
      } catch {
        return respond(res, 409, {
          message:
            "Stored credential data could not be hashed.",
          tokenId,
        });
      }

      if (
        normalizeHash(calculatedHash) !==
        normalizeHash(credential.fingerprint)
      ) {
        return respond(res, 409, {
          message:
            "Stored credential fingerprint does not match its data. Recovery blocked.",
          tokenId,
        });
      }

      if (
        credential.blockchainStatus === "confirmed"
      ) {
        return respond(res, 409, {
          message:
            "Credential is already confirmed.",
          tokenId,
          blockchainStatus: "confirmed",
        });
      }

      if (
        credential.blockchainStatus === "pending"
      ) {
        return respond(res, 409, {
          message:
            "Credential is pending. Reconcile the existing transaction before retrying.",
          tokenId,
          blockchainStatus: "pending",
          transactionHash:
            credential.transactionHash || null,
          reconciliationRequired: true,
        });
      }

      if (
        credential.blockchainStatus !== "failed"
      ) {
        return respond(res, 409, {
          message:
            "This credential is not eligible for retry recovery.",
          tokenId,
          blockchainStatus:
            credential.blockchainStatus,
        });
      }

      let onChain;

      try {
        onChain =
          await getCredentialFromBlockchain(
            tokenId
          );
      } catch (error) {
        console.error(
          "Retry blockchain lookup failed:",
          error.message
        );

        return respond(res, 503, {
          message:
            "Polygon Amoy RPC is unavailable. No transaction was submitted.",
          tokenId,
          blockchainStatus: "failed",
          retryAllowed: false,
        });
      }

      if (onChain.exists === true) {
        const fingerprintMatches =
          normalizeHash(onChain.fingerprint) ===
          normalizeHash(credential.fingerprint);

        const issuerMatches =
          String(
            onChain.issuer || ""
          ).toLowerCase() === institutionWallet;

        if (
          fingerprintMatches &&
          issuerMatches
        ) {
          return respond(res, 409, {
            message:
              "Credential already exists on Polygon Amoy with matching fingerprint and issuer. Reconciliation is required.",
            tokenId,
            blockchainStatus: "failed",
            reconciliationRequired: true,
            retryAllowed: false,
            onChainRecordMatches: true,
          });
        }

        return respond(res, 409, {
          message:
            "An incompatible blockchain record exists for this Token ID. Manual investigation is required.",
          tokenId,
          blockchainStatus: "failed",
          retryAllowed: false,
          onChainRecordMatches: false,
        });
      }

      if (!credential.transactionHash) {
        return respond(res, 409, {
          message:
            "No on-chain credential was found, but the original submission outcome is unknown because no transaction hash was saved. Manual recovery is required before another transaction can be sent.",
          tokenId,
          blockchainStatus: "failed",
          retryAllowed: false,
          recoveryReason:
            "unknown_previous_submission",
        });
      }

      let transaction;

      try {
        transaction =
          await checkTransactionStatus(
            credential.transactionHash
          );
      } catch (error) {
        console.error(
          "Retry transaction lookup failed:",
          error.message
        );

        return respond(res, 503, {
          message:
            "The previous transaction could not be checked. No retry transaction was submitted.",
          tokenId,
          blockchainStatus: "failed",
          retryAllowed: false,
        });
      }

      if (transaction.status === "confirmed") {
        return respond(res, 409, {
          message:
            "The previous transaction was confirmed. Reconciliation is required.",
          tokenId,
          transactionHash:
            credential.transactionHash,
          reconciliationRequired: true,
          retryAllowed: false,
        });
      }

      if (
        transaction.status === "pending" ||
        transaction.status === "not_found"
      ) {
        return respond(res, 409, {
          message:
            "The previous transaction is pending or its outcome is uncertain. Another transaction cannot be submitted.",
          tokenId,
          transactionHash:
            credential.transactionHash,
          retryAllowed: false,
        });
      }

      if (transaction.status === "failed") {
        return respond(res, 409, {
          message:
            "The previous transaction was mined and failed. The credential is a candidate for controlled retry after transaction safeguards are implemented.",
          tokenId,
          transactionHash:
            credential.transactionHash,
          previousTransactionFailed: true,
          retryAllowed: false,
        });
      }

      return respond(res, 409, {
        message:
          "Unexpected transaction status. Retry blocked.",
        tokenId,
        retryAllowed: false,
      });
    } catch (error) {
      console.error(
        "Credential retry recovery error:",
        error
      );

      return respond(res, 500, {
        message:
          "Retry recovery check failed. No retry transaction was submitted.",
        tokenId,
        retryAllowed: false,
      });
    }
  }
);

module.exports = router;

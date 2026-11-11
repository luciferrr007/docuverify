
const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const Credential = require("../models/Credential");

const {
  generateCredentialFingerprint,
} = require("../utils/credentialHash");

const institutionAuthMiddleware = require(
  "../middleware/institutionAuthMiddleware"
);

const {
  registerCredentialOnBlockchain,
  getCredentialFromBlockchain,
  checkTransactionStatus,
  getPlatformWalletAddress,
} = require("../services/blockchainService");

const CONTRACT_ADDRESS =
  "0xE3F7b3217620B9b833dab7Ad24cD4Ac79d16F7D2";

const BLOCKCHAIN_NETWORK = "polygon-amoy";

function generateIssuanceKey(
  issuerWalletAddress,
  documentTypeKey,
  fingerprint
) {
  const identity = JSON.stringify([
    issuerWalletAddress.toLowerCase(),
    documentTypeKey,
    fingerprint.toLowerCase(),
  ]);

  return crypto
    .createHash("sha256")
    .update(identity)
    .digest("hex");
}

function duplicateResponse(res, credential) {
  const blockchainStatus = credential.blockchainStatus;

  let message;

  if (blockchainStatus === "confirmed") {
    message =
      "This credential has already been issued. Please use the existing Token ID.";
  } else if (blockchainStatus === "pending") {
    message =
      "An issuance attempt for this credential is already pending. Check its transaction status before trying again.";
  } else if (blockchainStatus === "failed") {
    message =
      "A previous issuance attempt for this credential failed. Use the existing Token ID for a controlled retry after checking its transaction status.";
  } else {
    message =
      "An issuance record already exists for this credential. Review its status before attempting another issuance.";
  }

  return res.status(409).json({
    success: false,
    duplicate: true,
    message,
    existingCredential: {
      tokenId: credential.tokenId,
      blockchainStatus,
      status: credential.status,
      transactionHash: credential.transactionHash || null,
      blockNumber: credential.blockNumber ?? null,
    },
  });
}

// ==========================================
// ISSUE A NEW CREDENTIAL
// ONLY APPROVED INSTITUTIONS CAN ISSUE
// ==========================================

router.post(
  "/issue",
  institutionAuthMiddleware,
  async (req, res) => {
    let credential;

    try {
      const {
        tokenId,
        documentType,
        documentTypeKey,
        data,
        fingerprint,
        issuedAt,
      } = req.body;

      if (
        !tokenId ||
        typeof tokenId !== "string" ||
        !tokenId.trim() ||
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

      if (!/^[a-fA-F0-9]{64}$/.test(fingerprint)) {
        return res.status(400).json({
          success: false,
          message: "Invalid SHA-256 fingerprint format.",
        });
      }

      const issueDate = new Date(issuedAt);

      if (Number.isNaN(issueDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid credential issue date.",
        });
      }

      const issuerName =
        req.institution.institutionName;

      const issuerWalletAddress =
        req.institution.walletAddress;

      if (!issuerName || !issuerWalletAddress) {
        return res.status(400).json({
          success: false,
          message:
            "Institution name or registered wallet address is missing.",
        });
      }

      if (
        !/^0x[a-fA-F0-9]{40}$/.test(
          issuerWalletAddress
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Institution wallet address is invalid.",
        });
      }

      const normalizedWallet =
        issuerWalletAddress.toLowerCase();

      const credentialData = { ...data };

      if (
        documentTypeKey === "academic" ||
        documentTypeKey === "license"
      ) {
        credentialData.issuer = issuerName;
      }

      let calculatedFingerprint;

      try {
        calculatedFingerprint =
          generateCredentialFingerprint(
            documentTypeKey,
            credentialData
          );
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (
        calculatedFingerprint !==
        fingerprint.toLowerCase()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Fingerprint mismatch. Please ensure the issuer name matches your registered institution name and regenerate the fingerprint.",
        });
      }

      const normalizedTokenId = tokenId.trim();

      // ==========================================
      // CHECK EXISTING TOKEN ID
      // ==========================================

      const existingToken = await Credential.findOne({
        tokenId: normalizedTokenId,
      });

      if (existingToken) {
        return res.status(409).json({
          success: false,
          message:
            "A credential with this Token ID already exists.",
        });
      }

      // ==========================================
      // GENERATE DUPLICATE-PREVENTION KEY
      // ==========================================

      const issuanceKey = generateIssuanceKey(
        normalizedWallet,
        documentTypeKey,
        calculatedFingerprint
      );

      // ==========================================
      // CHECK EXISTING CREDENTIAL CONTENT
      // INCLUDES LEGACY RECORDS
      // ==========================================

      const existingCredential =
        await Credential.findOne({
          issuerWalletAddress: normalizedWallet,
          documentTypeKey,
          fingerprint: calculatedFingerprint,
        });

      if (existingCredential) {
        return duplicateResponse(
          res,
          existingCredential
        );
      }

      // ==========================================
      // CREATE CREDENTIAL IN MONGODB
      // UNIQUE INDEX PROTECTS CONCURRENT REQUESTS
      // ==========================================

      try {
        credential = await Credential.create({
          tokenId: normalizedTokenId,
          documentType,
          documentTypeKey,
          data: credentialData,
          fingerprint: calculatedFingerprint,
          issuanceKey,
          issuedAt: issueDate,
          issuerName,
          issuerWalletAddress: normalizedWallet,
          blockchainStatus: "pending",
          blockchainNetwork: BLOCKCHAIN_NETWORK,
          contractAddress: CONTRACT_ADDRESS,
          status: "active",
        });
      } catch (error) {
        if (error.code === 11000) {
          const duplicateFields =
            error.keyPattern || {};

          if (duplicateFields.issuanceKey) {
            const duplicate =
              await Credential.findOne({
                issuanceKey,
                issuerWalletAddress: normalizedWallet,
              });

            if (duplicate) {
              return duplicateResponse(
                res,
                duplicate
              );
            }

            return res.status(409).json({
              success: false,
              duplicate: true,
              message:
                "An identical credential issuance is already being processed. Check the institution dashboard before trying again.",
            });
          }

          return res.status(409).json({
            success: false,
            message:
              "A credential with this Token ID already exists, or an identical credential is already being processed.",
          });
        }

        throw error;
      }

      // ==========================================
      // REGISTER CREDENTIAL ON POLYGON
      // ==========================================

      let blockchainResult;

      try {
        blockchainResult =
          await registerCredentialOnBlockchain(
            normalizedTokenId,
            `0x${calculatedFingerprint}`,
            issuerWalletAddress,

            async (transactionDetails) => {
              const updatedCredential =
                await Credential.findByIdAndUpdate(
                  credential._id,
                  {
                    transactionHash:
                      transactionDetails.transactionHash,

                    transactionNonce:
                      transactionDetails.nonce,

                    transactionChainId:
                      transactionDetails.chainId,

                    transactionSubmittedAt: new Date(),

                    blockchainStatus: "pending",
                  },
                  {
                    returnDocument: "after",
                    runValidators: true,
                  }
                );

              if (!updatedCredential) {
                throw new Error(
                  "Could not save submitted transaction details in MongoDB."
                );
              }

              console.log(
                "Transaction submitted and saved:",
                transactionDetails.transactionHash
              );
            }
          );
      } catch (blockchainError) {
        console.error(
          "Blockchain registration error:",
          blockchainError
        );

        const transactionWasSubmitted =
          blockchainError.transactionSubmitted === true ||
          Boolean(blockchainError.transactionHash);

        if (transactionWasSubmitted) {
          const transactionDetails =
            blockchainError.transactionDetails || {};

          const transactionHash =
            blockchainError.transactionHash ||
            transactionDetails.transactionHash ||
            null;

          const transactionFailed =
            blockchainError.transactionFailed === true;

          let databaseUpdateSucceeded = false;

          try {
            const updatedCredential =
              await Credential.findByIdAndUpdate(
                credential._id,
                {
                  ...(transactionHash && {
                    transactionHash,
                  }),

                  ...(transactionDetails.nonce !==
                    undefined && {
                    transactionNonce:
                      transactionDetails.nonce,
                  }),

                  ...(transactionDetails.chainId && {
                    transactionChainId:
                      transactionDetails.chainId,
                  }),

                  ...(transactionDetails.blockNumber !==
                    undefined && {
                    blockNumber:
                      transactionDetails.blockNumber,
                  }),

                  transactionSubmittedAt: new Date(),

                  blockchainStatus: transactionFailed
                    ? "failed"
                    : "pending",
                },
                {
                  returnDocument: "after",
                  runValidators: true,
                }
              );

            databaseUpdateSucceeded =
              Boolean(updatedCredential);
          } catch (databaseError) {
            console.error(
              "Could not preserve transaction details:",
              databaseError
            );
          }

          if (transactionFailed) {
            return res.status(502).json({
              success: false,

              message: databaseUpdateSucceeded
                ? "Transaction was mined on Polygon but reverted during smart contract execution."
                : "Transaction was mined and reverted, but MongoDB could not be updated. Manual reconciliation is required.",

              tokenId: credential.tokenId,
              blockchainStatus: "failed",
              databaseUpdated:
                databaseUpdateSucceeded,
              transactionHash,

              blockNumber:
                transactionDetails.blockNumber ??
                null,
            });
          }

          return res.status(202).json({
            success: false,

            message:
              "Transaction was submitted to Polygon, but confirmation could not be obtained. Check its status before attempting any retry.",

            tokenId: credential.tokenId,
            blockchainStatus: "pending",
            databaseUpdated:
              databaseUpdateSucceeded,
            transactionHash,
          });
        }

        try {
          await Credential.findByIdAndUpdate(
            credential._id,
            {
              blockchainStatus: "failed",
            },
            {
              runValidators: true,
            }
          );
        } catch (databaseError) {
          console.error(
            "Could not update failed credential status:",
            databaseError
          );
        }

        return res.status(502).json({
          success: false,
          message:
            "Blockchain transaction could not be submitted.",

          tokenId: credential.tokenId,
          blockchainStatus: "failed",
        });
      }

      // ==========================================
      // BLOCKCHAIN CONFIRMATION SUCCESSFUL
      // ==========================================

      try {
        const confirmedCredential =
          await Credential.findByIdAndUpdate(
            credential._id,
            {
              blockchainStatus: "confirmed",

              transactionHash:
                blockchainResult.transactionHash,

              blockNumber:
                blockchainResult.blockNumber,

              contractAddress:
                blockchainResult.contractAddress,
            },
            {
              returnDocument: "after",
              runValidators: true,
            }
          );

        if (!confirmedCredential) {
          throw new Error(
            "Credential record was not found after blockchain confirmation."
          );
        }

        return res.status(201).json({
          success: true,

          message:
            "Credential successfully issued and registered on Polygon Amoy.",

          credential: confirmedCredential,

          blockchain: {
            status: "confirmed",

            transactionHash:
              blockchainResult.transactionHash,

            blockNumber:
              blockchainResult.blockNumber,

            contractAddress:
              blockchainResult.contractAddress,

            network: BLOCKCHAIN_NETWORK,
          },
        });
      } catch (databaseError) {
        console.error(
          "MongoDB update after blockchain confirmation failed:",
          databaseError
        );

        return res.status(500).json({
          success: false,

          message:
            "Blockchain registration succeeded, but MongoDB could not be updated. Reconciliation is required.",

          tokenId: credential.tokenId,
          blockchainStatus: "pending",

          transactionHash:
            blockchainResult.transactionHash,
        });
      }
    } catch (error) {
      console.error(
        "Issue credential error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to issue credential.",
      });
    }
  }
);

// ==========================================
// RECONCILE A PENDING TRANSACTION
// ONLY THE ISSUING INSTITUTION CAN RECONCILE
// ==========================================

router.post(
  "/reconcile/:tokenId",
  institutionAuthMiddleware,
  async (req, res) => {
    try {
      const { tokenId } = req.params;

      const institutionWallet =
        req.institution.walletAddress.toLowerCase();

      const credential = await Credential.findOne({
        tokenId,
        issuerWalletAddress: institutionWallet,
      });

      if (!credential) {
        return res.status(404).json({
          success: false,
          message:
            "Credential not found for this institution.",
        });
      }

      // ==========================================
      // VALIDATE SUPPLIED TRANSACTION HASH
      // ==========================================

      if (
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          "transactionHash"
        ) &&
        (typeof req.body.transactionHash !== "string" ||
          !/^0x[a-fA-F0-9]{64}$/.test(
            req.body.transactionHash
          ))
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid transaction hash format.",
        });
      }

      // ==========================================
      // ALREADY CONFIRMED
      // ==========================================

      if (
        credential.blockchainStatus === "confirmed"
      ) {
        return res.status(200).json({
          success: true,
          message: "Credential is already confirmed.",
          blockchainStatus: "confirmed",
          tokenId: credential.tokenId,
          transactionHash:
            credential.transactionHash,
          blockNumber: credential.blockNumber,
        });
      }

      // ==========================================
      // RECOVER OR VALIDATE TRANSACTION HASH
      // ==========================================

      let transactionHash =
        credential.transactionHash;

      if (
        !transactionHash &&
        req.body.transactionHash
      ) {
        const suppliedHash =
          req.body.transactionHash;

        transactionHash = suppliedHash;

        try {
          await Credential.findByIdAndUpdate(
            credential._id,
            {
              transactionHash,

              transactionSubmittedAt:
                credential.transactionSubmittedAt ||
                new Date(),
            },
            {
              returnDocument: "after",
              runValidators: true,
            }
          );
        } catch (databaseError) {
          console.error(
            "Could not save supplied transaction hash:",
            databaseError
          );

          return res.status(500).json({
            success: false,
            message:
              "Could not save the transaction hash. Please try again.",
          });
        }
      }

      if (!transactionHash) {
        return res.status(409).json({
          success: false,
          message:
            "No transaction hash is saved. Provide the submitted transaction hash to reconcile this credential.",
          blockchainStatus:
            credential.blockchainStatus,
        });
      }

      // ==========================================
      // CHECK TRANSACTION ON POLYGON
      // ==========================================

      let transactionResult;

      try {
        transactionResult =
          await checkTransactionStatus(
            transactionHash
          );
      } catch (rpcError) {
        console.error(
          "Transaction status RPC error:",
          rpcError
        );

        return res.status(503).json({
          success: false,

          message:
            "Unable to check transaction status because the blockchain RPC is temporarily unavailable. Try again later.",

          blockchainStatus:
            credential.blockchainStatus,

          transactionHash,
        });
      }

      // ==========================================
      // TRANSACTION PENDING OR NOT FOUND
      // ==========================================

      if (
        transactionResult.status === "pending" ||
        transactionResult.status === "not_found"
      ) {
        return res.status(200).json({
          success: true,

          message:
            transactionResult.status === "pending"
              ? "Transaction is still pending on Polygon."
              : "Transaction is not currently found by the RPC. Check again later; do not retry registration yet.",

          blockchainStatus: "pending",
          transactionHash,
        });
      }

      // ==========================================
      // TRANSACTION MINED BUT FAILED
      // ==========================================

      if (
        transactionResult.status === "failed"
      ) {
        try {
          await Credential.findByIdAndUpdate(
            credential._id,
            {
              blockchainStatus: "failed",
              blockNumber:
                transactionResult.blockNumber,
              transactionHash,
            },
            {
              returnDocument: "after",
              runValidators: true,
            }
          );
        } catch (databaseError) {
          console.error(
            "Could not save failed transaction status:",
            databaseError
          );

          return res.status(500).json({
            success: false,

            message:
              "Transaction failed on Polygon, but MongoDB could not be updated. Retry reconciliation.",

            blockchainStatus: "pending",
            transactionHash,

            blockNumber:
              transactionResult.blockNumber,
          });
        }

        return res.status(200).json({
          success: true,

          message:
            "Transaction was included in a block but failed during execution.",

          blockchainStatus: "failed",
          transactionHash,
          blockNumber:
            transactionResult.blockNumber,
        });
      }

      // ==========================================
      // TRANSACTION CONFIRMED
      // ==========================================

      if (
        transactionResult.status !== "confirmed"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Unexpected transaction status. Manual investigation is required.",

          blockchainStatus:
            credential.blockchainStatus,

          transactionHash,
        });
      }

      const platformWallet = (
        await getPlatformWalletAddress()
      ).toLowerCase();

      const transactionFromMatches =
        transactionResult.from?.toLowerCase() ===
        platformWallet;

      const transactionToMatches =
        transactionResult.to?.toLowerCase() ===
        CONTRACT_ADDRESS.toLowerCase();

      if (
        !transactionFromMatches ||
        !transactionToMatches
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Transaction sender or destination does not match the DocuVerify platform configuration.",

          blockchainStatus: "pending",
          transactionHash,
        });
      }

      // ==========================================
      // VERIFY ON-CHAIN CREDENTIAL
      // ==========================================

      const blockchainCredential =
        await getCredentialFromBlockchain(
          credential.tokenId
        );

      if (!blockchainCredential.exists) {
        return res.status(409).json({
          success: false,

          message:
            "Transaction succeeded, but the credential was not found in the smart contract.",

          blockchainStatus: "pending",
          transactionHash,
        });
      }

      const blockchainFingerprint =
        blockchainCredential.fingerprint
          .replace(/^0x/i, "")
          .toLowerCase();

      const fingerprintMatches =
        blockchainFingerprint ===
        credential.fingerprint.toLowerCase();

      const issuerMatches =
        blockchainCredential.issuer.toLowerCase() ===
        credential.issuerWalletAddress.toLowerCase();

      if (
        !fingerprintMatches ||
        !issuerMatches
      ) {
        return res.status(409).json({
          success: false,

          message:
            "On-chain credential data does not match the MongoDB record. Manual investigation is required.",

          blockchainStatus: "pending",
          fingerprintMatches,
          issuerMatches,
          transactionHash,
        });
      }

      // ==========================================
      // ALL CHECKS PASSED
      // ==========================================

      const updatedCredential =
        await Credential.findByIdAndUpdate(
          credential._id,
          {
            blockchainStatus: "confirmed",
            transactionHash,

            blockNumber:
              transactionResult.blockNumber,

            contractAddress:
              CONTRACT_ADDRESS,
          },
          {
            returnDocument: "after",
            runValidators: true,
          }
        );

      if (!updatedCredential) {
        return res.status(500).json({
          success: false,

          message:
            "Blockchain verification succeeded, but MongoDB could not be updated.",

          blockchainStatus: "pending",
          transactionHash,
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Transaction successfully reconciled. Credential is confirmed on Polygon Amoy.",

        blockchainStatus: "confirmed",
        credential: updatedCredential,

        blockchain: {
          network: BLOCKCHAIN_NETWORK,
          transactionHash,

          blockNumber:
            transactionResult.blockNumber,

          contractAddress:
            CONTRACT_ADDRESS,

          fingerprintMatches,
          issuerMatches,
        },
      });
    } catch (error) {
      console.error(
        "Transaction reconciliation error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to reconcile blockchain transaction.",
      });
    }
  }
);

// ==========================================
// PUBLIC: VERIFY CREDENTIAL
// MONGODB + SHA-256 + BLOCKCHAIN
// ==========================================

router.get("/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;

    const credential = await Credential.findOne({
      tokenId,
    });

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found.",
      });
    }

    // ==========================================
    // RECALCULATE CREDENTIAL FINGERPRINT
    // ==========================================

    let calculatedFingerprint;

    try {
      calculatedFingerprint =
        generateCredentialFingerprint(
          credential.documentTypeKey,
          credential.data
        );
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          "Unable to validate credential data.",
      });
    }

    const integrityValid =
      calculatedFingerprint ===
      credential.fingerprint;

    // ==========================================
    // RETRIEVE BLOCKCHAIN RECORD
    // ==========================================

    let blockchainCredential;

    try {
      blockchainCredential =
        await getCredentialFromBlockchain(
          credential.tokenId
        );
    } catch (blockchainError) {
      console.error(
        "Blockchain verification error:",
        blockchainError
      );

      return res.status(503).json({
        success: false,

        message:
          "Blockchain verification is temporarily unavailable. Please try again later.",

          tokenId: credential.tokenId,

          verification: {
            credentialExists: true,
            integrityValid,
            blockchainAvailable: false,
            blockchainVerified: false,
            isValid: false,
          },
        });
      }

      // ==========================================
      // COMPARE DATA WITH BLOCKCHAIN
      // ==========================================

      const blockchainRecordExists =
        blockchainCredential.exists === true;

      const blockchainFingerprint =
        blockchainCredential.fingerprint
          .replace(/^0x/i, "")
          .toLowerCase();

      const blockchainFingerprintMatches =
        blockchainRecordExists &&
        blockchainFingerprint ===
          calculatedFingerprint.toLowerCase();

      const blockchainIssuerMatches =
        blockchainRecordExists &&
        Boolean(credential.issuerWalletAddress) &&
        blockchainCredential.issuer.toLowerCase() ===
          credential.issuerWalletAddress.toLowerCase();

      const blockchainConfirmed =
        credential.blockchainStatus === "confirmed";

      const contractAddressMatches =
        Boolean(credential.contractAddress) &&
        credential.contractAddress.toLowerCase() ===
          CONTRACT_ADDRESS.toLowerCase();

      const blockchainVerified =
        blockchainRecordExists &&
        blockchainFingerprintMatches &&
        blockchainIssuerMatches &&
        blockchainConfirmed &&
        contractAddressMatches;

      const isValid =
        integrityValid &&
        blockchainVerified &&
        credential.status === "active";

      // ==========================================
      // BUILD VERIFICATION MESSAGE
      // ==========================================

      let message;

      if (!integrityValid) {
        message =
          "Credential data integrity check failed.";
      } else if (
        credential.status === "revoked"
      ) {
        message =
          "Credential has been revoked.";
      } else if (!blockchainRecordExists) {
        message =
          "Credential does not exist on the blockchain.";
      } else if (
        !blockchainFingerprintMatches
      ) {
        message =
          "Blockchain fingerprint does not match.";
      } else if (!blockchainIssuerMatches) {
        message =
          "Blockchain issuer does not match the institution record.";
      } else if (!blockchainConfirmed) {
        message =
          "Blockchain registration is not confirmed in MongoDB.";
      } else if (!contractAddressMatches) {
        message =
          "Blockchain contract address does not match.";
      } else if (!blockchainVerified) {
        message =
          "Blockchain verification failed.";
      } else {
        message =
          "Credential is authentic and active.";
      }

      // ==========================================
      // RETURN COMPLETE VERIFICATION RESULT
      // ==========================================

      return res.status(200).json({
        success: true,
        message,

        verification: {
          credentialExists: true,
          integrityValid,
          blockchainAvailable: true,
          blockchainRecordExists,
          blockchainFingerprintMatches,
          blockchainIssuerMatches,
          blockchainConfirmed,
          contractAddressMatches,
          blockchainVerified,
          status: credential.status,
          blockchainStatus:
            credential.blockchainStatus,
          isValid,
        },

        blockchain: {
          network: BLOCKCHAIN_NETWORK,
          contractAddress: CONTRACT_ADDRESS,

          issuer: blockchainRecordExists
            ? blockchainCredential.issuer
            : null,

          registeredAt: blockchainRecordExists
            ? blockchainCredential.registeredAt
            : null,
        },

        credential,
      });
    } catch (error) {
      console.error(
        "Verify credential error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to verify credential.",
      });
    }
  }
);

module.exports = router;

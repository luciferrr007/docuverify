
const express = require("express");

const router = express.Router();

const Credential = require("../models/Credential");

const institutionAuthMiddleware = require(
  "../middleware/institutionAuthMiddleware"
);

router.get(
  "/mine",
  institutionAuthMiddleware,
  async (req, res) => {
    try {
      const walletAddress = String(
        req.institution.walletAddress || ""
      ).toLowerCase();

      if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: "Invalid institution wallet address.",
        });
      }

      const requestedPage = Number(
        req.query.page || 1
      );

      const page =
        Number.isSafeInteger(requestedPage) &&
        requestedPage > 0
          ? Math.min(requestedPage, 100000)
          : 1;

      const pageSize = 20;
      const skip = (page - 1) * pageSize;

      const filter = {
        issuerWalletAddress: walletAddress,
      };

      const [
        credentials,
        total,
        confirmed,
        pending,
        failed,
        notRegistered,
      ] = await Promise.all([
        Credential.find(filter)
          .select(
            "tokenId documentType documentTypeKey issuedAt createdAt blockchainStatus status transactionHash blockNumber"
          )
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip(skip)
          .limit(pageSize)
          .lean(),

        Credential.countDocuments(filter),

        Credential.countDocuments({
          ...filter,
          blockchainStatus: "confirmed",
        }),

        Credential.countDocuments({
          ...filter,
          blockchainStatus: "pending",
        }),

        Credential.countDocuments({
          ...filter,
          blockchainStatus: "failed",
        }),

        Credential.countDocuments({
          ...filter,
          blockchainStatus: "not_registered",
        }),
      ]);

      return res.status(200).json({
        success: true,
        message:
          "Institution credentials retrieved successfully.",

        count: credentials.length,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),

        summary: {
          total,
          confirmed,
          pending,
          failed,
          notRegistered,
        },

        credentials: credentials.map(
          (credential) => ({
            tokenId: credential.tokenId,
            documentType:
              credential.documentType,
            documentTypeKey:
              credential.documentTypeKey,
            issuedAt: credential.issuedAt,
            createdAt: credential.createdAt,
            blockchainStatus:
              credential.blockchainStatus,
            status: credential.status,
            transactionHash:
              credential.transactionHash || null,
            blockNumber:
              credential.blockNumber ?? null,
          })
        ),
      });
    } catch (error) {
      console.error(
        "Institution credential list error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to retrieve institution credentials.",
      });
    }
  }
);

module.exports = router;

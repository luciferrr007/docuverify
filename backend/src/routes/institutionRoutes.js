
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Institution = require("../models/Institution");
const authMiddleware = require("../middleware/authMiddleware");

// ==========================================
// PUBLIC: REGISTER A NEW INSTITUTION
// ==========================================

router.post("/register", async (req, res) => {
  try {
    const {
      institutionName,
      officialWebsite,
      officialEmail,
      registrationDetails,
      walletAddress,
      verificationDocuments,
    } = req.body;

    if (
      !institutionName ||
      !officialWebsite ||
      !officialEmail ||
      !registrationDetails ||
      !walletAddress
    ) {
      return res.status(400).json({
        success: false,
        message: "All required institution details must be provided.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(officialEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid institutional email address.",
      });
    }

    try {
      const website = new URL(officialWebsite);

      if (!["http:", "https:"].includes(website.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid institution website URL.",
      });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid wallet address.",
      });
    }

    const existingInstitution = await Institution.findOne({
      $or: [
        { officialEmail: officialEmail.toLowerCase().trim() },
        { walletAddress: walletAddress.toLowerCase() },
      ],
    });

    if (existingInstitution) {
      return res.status(409).json({
        success: false,
        message:
          "An institution with this email or wallet address is already registered.",
      });
    }

    const institution = await Institution.create({
      institutionName: institutionName.trim(),
      officialWebsite: officialWebsite.trim(),
      officialEmail: officialEmail.toLowerCase().trim(),
      registrationDetails: registrationDetails.trim(),
      walletAddress: walletAddress.toLowerCase(),
      verificationDocuments: Array.isArray(verificationDocuments)
        ? verificationDocuments
        : [],
      applicationStatus: "pending",
    });

    return res.status(201).json({
      success: true,
      message:
        "Institution registration submitted successfully. Your application is pending admin approval.",
      institution: {
        id: institution._id,
        institutionName: institution.institutionName,
        officialEmail: institution.officialEmail,
        walletAddress: institution.walletAddress,
        applicationStatus: institution.applicationStatus,
        createdAt: institution.createdAt,
      },
    });
  } catch (error) {
    console.error("Institution registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit institution registration.",
    });
  }
});

// ==========================================
// ADMIN: VIEW ALL PENDING APPLICATIONS
// ==========================================

router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const institutions = await Institution.find({
      applicationStatus: "pending",
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: institutions.length,
      institutions,
    });
  } catch (error) {
    console.error("Fetch pending institutions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch pending applications.",
    });
  }
});

// ==========================================
// ADMIN: VIEW ONE INSTITUTION APPLICATION
// ==========================================

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution ID.",
      });
    }

    const institution = await Institution.findById(req.params.id);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution application not found.",
      });
    }

    return res.status(200).json({
      success: true,
      institution,
    });
  } catch (error) {
    console.error("Fetch institution error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch institution application.",
    });
  }
});

// ==========================================
// ADMIN: APPROVE AN INSTITUTION
// ==========================================

router.patch("/:id/approve", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution ID.",
      });
    }

    const institution = await Institution.findById(req.params.id);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution application not found.",
      });
    }

    if (institution.applicationStatus !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This application has already been reviewed.",
      });
    }

    institution.applicationStatus = "approved";
    institution.approvedAt = new Date();
    institution.rejectedAt = null;
    institution.rejectionReason = null;
    institution.reviewedBy = req.admin.id;

    await institution.save();

    return res.status(200).json({
      success: true,
      message: "Institution approved successfully.",
      institution,
    });
  } catch (error) {
    console.error("Approve institution error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to approve institution.",
    });
  }
});

// ==========================================
// ADMIN: REJECT AN INSTITUTION
// ==========================================

router.patch("/:id/reject", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution ID.",
      });
    }

    const { rejectionReason } = req.body;

    if (
      typeof rejectionReason !== "string" ||
      !rejectionReason.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required.",
      });
    }

    const institution = await Institution.findById(req.params.id);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution application not found.",
      });
    }

    if (institution.applicationStatus !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This application has already been reviewed.",
      });
    }

    institution.applicationStatus = "rejected";
    institution.rejectedAt = new Date();
    institution.approvedAt = null;
    institution.rejectionReason = rejectionReason.trim();
    institution.reviewedBy = req.admin.id;

    await institution.save();

    return res.status(200).json({
      success: true,
      message: "Institution rejected successfully.",
      institution,
    });
  } catch (error) {
    console.error("Reject institution error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reject institution.",
    });
  }
});

module.exports = router;

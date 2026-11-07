
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
      password,
      registrationDetails,
      walletAddress,
      verificationDocuments,
    } = req.body;

    if (
      !institutionName ||
      !officialWebsite ||
      !officialEmail ||
      !password ||
      !registrationDetails ||
      !walletAddress
    ) {
      return res.status(400).json({
        success: false,
        message: "All required institution details must be provided.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    if (
      typeof officialEmail !== "string" ||
      typeof institutionName !== "string" ||
      typeof officialWebsite !== "string" ||
      typeof registrationDetails !== "string" ||
      typeof walletAddress !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution details.",
      });
    }

    const normalizedEmail = officialEmail.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
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

    const normalizedWallet = walletAddress.toLowerCase();

    const existingInstitution = await Institution.findOne({
      $or: [
        { officialEmail: normalizedEmail },
        { walletAddress: normalizedWallet },
      ],
    });

    if (existingInstitution) {
      return res.status(409).json({
        success: false,
        message:
          "An institution with this email or wallet address is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const institution = await Institution.create({
      institutionName: institutionName.trim(),
      officialWebsite: officialWebsite.trim(),
      officialEmail: normalizedEmail,
      password: hashedPassword,
      registrationDetails: registrationDetails.trim(),
      walletAddress: normalizedWallet,
      verificationDocuments: Array.isArray(verificationDocuments)
        ? verificationDocuments
        : [],
      applicationStatus: "pending",
      isActive: true,
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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An institution with this email or wallet is already registered.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to submit institution registration.",
    });
  }
});

// ==========================================
// PUBLIC: INSTITUTION LOGIN
// ==========================================

router.post("/login", async (req, res) => {
  try {
    const { officialEmail, password } = req.body;

    if (
      typeof officialEmail !== "string" ||
      typeof password !== "string" ||
      !officialEmail.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Institution email and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication is not configured on the server.",
      });
    }

    const normalizedEmail = officialEmail.toLowerCase().trim();

    // Explicitly select password because the schema uses select: false
    const institution = await Institution.findOne({
      officialEmail: normalizedEmail,
    }).select("+password");

    if (!institution) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!institution.isActive) {
      return res.status(403).json({
        success: false,
        message: "This institution account is inactive.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      institution.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Generate institution JWT
    const token = jwt.sign(
      {
        id: institution._id.toString(),
        role: "institution",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Institution login successful.",
      token,
      institution: {
        id: institution._id,
        institutionName: institution.institutionName,
        officialEmail: institution.officialEmail,
        walletAddress: institution.walletAddress,
        applicationStatus: institution.applicationStatus,
        rejectionReason: institution.rejectionReason,
        approvedAt: institution.approvedAt,
      },
    });
  } catch (error) {
    console.error("Institution login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in to institution account.",
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
// ADMIN: VIEW APPLICATIONS BY STATUS
// ==========================================

router.get("/status/:status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.params;

    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status.",
      });
    }

    const institutions = await Institution.find({
      applicationStatus: status,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: institutions.length,
      institutions,
    });
  } catch (error) {
    console.error("Fetch institutions by status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch institution applications.",
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

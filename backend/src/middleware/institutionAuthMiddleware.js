
const jwt = require("jsonwebtoken");
const Institution = require("../models/Institution");

const institutionAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication is not configured on the server.",
      });
    }

    let decoded;

    // Verify JWT separately so we can identify the exact error.
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error("JWT verification failed:", {
        name: error.name,
        message: error.message,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
        errorType: error.name,
      });
    }

    if (decoded.role !== "institution" || !decoded.id) {
      return res.status(403).json({
        success: false,
        message: "Institution privileges required.",
      });
    }

    const institution = await Institution.findById(decoded.id);

    if (!institution || !institution.isActive) {
      return res.status(401).json({
        success: false,
        message: "Institution account is invalid or inactive.",
      });
    }

    if (institution.applicationStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message:
          "Your institution must be approved before issuing credentials.",
      });
    }

    req.institution = {
      id: institution._id,
      institutionName: institution.institutionName,
      officialEmail: institution.officialEmail,
      walletAddress: institution.walletAddress,
      role: "institution",
    };

    next();
  } catch (error) {
    console.error("Institution authentication error:", {
      name: error.name,
      message: error.message,
    });

    return res.status(500).json({
      success: false,
      message: "Institution authentication failed.",
    });
  }
};

module.exports = institutionAuthMiddleware;

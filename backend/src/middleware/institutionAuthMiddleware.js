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

    const token = authHeader.split(" ")[1];

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
        message: "Your institution must be approved before issuing credentials.",
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
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    console.error("Institution authentication error:", error);

    return res.status(500).json({
      success: false,
      message: "Institution authentication failed.",
    });
  }
};

module.exports = institutionAuthMiddleware;

const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const authMiddleware = async (req, res, next) => {
  try {
    // Check whether Authorization header exists
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    // Extract JWT token
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

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check administrator role
    if (decoded.role !== "platform_admin" || !decoded.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Administrator privileges required.",
      });
    }

    // Confirm that administrator still exists and is active
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive || admin.role !== "platform_admin") {
      return res.status(401).json({
        success: false,
        message: "Administrator account is invalid or inactive.",
      });
    }

    // Make administrator details available to protected routes
    req.admin = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
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

    console.error("Authentication middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

module.exports = authMiddleware;

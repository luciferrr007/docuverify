const crypto = require("crypto");

// Field order must match the existing frontend.
const CANONICAL_ORDER = {
  academic: ["degreeId", "regNumber", "holderName", "degreeTitle", "yearOfCompletion", "issuer"],

  license: ["licenseNumber", "licenseType", "holderName", "issueDate", "expiryDate", "issuer"],

  government: ["documentId", "holderName", "dob", "issueDate", "issuingAuthority"],
};

// Recreate the canonical credential string.
function createCanonicalData(documentTypeKey, data) {
  const fieldOrder = CANONICAL_ORDER[documentTypeKey];

  if (!fieldOrder) {
    throw new Error("Unsupported credential type.");
  }

  return fieldOrder
    .map((field) =>
      String(data[field] ?? "")
        .trim()
        .toUpperCase(),
    )
    .join("|");
}

// Generate SHA-256 fingerprint.
function generateCredentialFingerprint(documentTypeKey, data) {
  const canonicalData = createCanonicalData(documentTypeKey, data);

  return crypto.createHash("sha256").update(canonicalData, "utf8").digest("hex");
}

module.exports = {
  createCanonicalData,
  generateCredentialFingerprint,
};

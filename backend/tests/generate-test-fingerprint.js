
const {
  createCanonicalData,
  generateCredentialFingerprint,
} = require("../src/utils/credentialHash");

const data = {
  degreeId: "DEG-2026-001",
  regNumber: "TEST-REG-001",
  holderName: "Test Student",
  degreeTitle: "Bachelor of Technology",
  yearOfCompletion: "2026",
  issuer: "Demo University",
};

const canonicalData = createCanonicalData("academic", data);
const fingerprint = generateCredentialFingerprint("academic", data);

console.log("Canonical Data:", canonicalData);
console.log("Fingerprint:", fingerprint);

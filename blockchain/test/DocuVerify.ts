
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("DocuVerify", function () {
  async function deployDocuVerify() {
    const [owner, institution, other] = await ethers.getSigners();

    const docuVerify = await ethers.deployContract("DocuVerify");

    return { docuVerify, owner, institution, other };
  }

  it("Should deploy with the correct platform owner", async function () {
    const { docuVerify, owner } = await deployDocuVerify();

    expect(await docuVerify.owner()).to.equal(owner.address);
  });

  it("Should register a credential with the correct issuer wallet", async function () {
    const { docuVerify, institution } = await deployDocuVerify();

    const tokenId = "DCR-2026-TEST001";
    const fingerprint = ethers.id("test credential fingerprint");

    await docuVerify.registerCredential(
      tokenId,
      fingerprint,
      institution.address
    );

    const credential = await docuVerify.getCredential(tokenId);

    expect(credential.fingerprint).to.equal(fingerprint);
    expect(credential.issuer).to.equal(institution.address);
    expect(credential.registeredAt).to.be.greaterThan(0n);
    expect(credential.exists).to.equal(true);
  });

  it("Should prevent non-owner accounts from registering credentials", async function () {
    const { docuVerify, institution, other } = await deployDocuVerify();

    await expect(
      docuVerify.connect(other).registerCredential(
        "DCR-2026-TEST002",
        ethers.id("fingerprint"),
        institution.address
      )
    ).to.be.revertedWith(
      "Only platform owner can register credentials"
    );
  });

  it("Should prevent duplicate Token IDs", async function () {
    const { docuVerify, institution } = await deployDocuVerify();

    const tokenId = "DCR-2026-TEST003";
    const fingerprint = ethers.id("fingerprint");

    await docuVerify.registerCredential(
      tokenId,
      fingerprint,
      institution.address
    );

    await expect(
      docuVerify.registerCredential(
        tokenId,
        ethers.id("another fingerprint"),
        institution.address
      )
    ).to.be.revertedWith("Credential already registered");
  });

  it("Should reject an empty Token ID", async function () {
    const { docuVerify, institution } = await deployDocuVerify();

    await expect(
      docuVerify.registerCredential(
        "",
        ethers.id("fingerprint"),
        institution.address
      )
    ).to.be.revertedWith("Token ID cannot be empty");
  });

  it("Should reject an empty fingerprint", async function () {
    const { docuVerify, institution } = await deployDocuVerify();

    await expect(
      docuVerify.registerCredential(
        "DCR-2026-TEST004",
        ethers.ZeroHash,
        institution.address
      )
    ).to.be.revertedWith("Fingerprint cannot be empty");
  });

  it("Should reject a zero issuer address", async function () {
    const { docuVerify } = await deployDocuVerify();

    await expect(
      docuVerify.registerCredential(
        "DCR-2026-TEST005",
        ethers.id("fingerprint"),
        ethers.ZeroAddress
      )
    ).to.be.revertedWith("Issuer address cannot be zero");
  });

  it("Should allow public users to read credential details", async function () {
    const { docuVerify, institution, other } = await deployDocuVerify();

    const tokenId = "DCR-2026-TEST006";
    const fingerprint = ethers.id("public verification fingerprint");

    await docuVerify.registerCredential(
      tokenId,
      fingerprint,
      institution.address
    );

    const credential = await docuVerify.connect(other).getCredential(tokenId);

    expect(credential.fingerprint).to.equal(fingerprint);
    expect(credential.issuer).to.equal(institution.address);
    expect(credential.exists).to.equal(true);
  });
});

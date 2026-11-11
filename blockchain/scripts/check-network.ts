import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  console.log("Checking Polygon Amoy connection...\n");

  const chainId = await ethers.provider.getNetwork();
  console.log("Connected Chain ID:", chainId.chainId.toString());

  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();
  console.log("Wallet Address:", address);

  const balance = await ethers.provider.getBalance(address);
  console.log(
    "Wallet Balance:",
    ethers.formatEther(balance),
    "POL"
  );

  console.log("\nNetwork connection successful!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
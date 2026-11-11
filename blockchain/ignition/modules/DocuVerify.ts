
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DocuVerifyModule", (m) => {
  const docuVerify = m.contract("DocuVerify");

  return { docuVerify };
});

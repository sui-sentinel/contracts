// Deploy operations
export {
  syncProgramIds,
  buildProgram,
  deployProgram,
  showProgramStatus,
} from "./deploy";

// Admin operations
export {
  initialize,
  setEnclavePubkey,
  updateEnclavePubkey,
  updateFeeRatios,
  updateProtocolWallet,
  transferAdmin,
  updateDynamicFeeSettings,
  pauseProtocol,
  unpauseProtocol,
} from "./admin";

// View operations
export { viewProtocolConfig } from "./view";

// Agent operations
export {
  registerAgent,
  listAllAgents,
  requestAttack,
} from "./agent";

// Token operations
export {
  deriveTokenAccount,
  createTokenAccount,
  wrapSol,
  unwrapSol,
  showTokenBalances,
  getProtocolWalletTokenAccount,
} from "./token";

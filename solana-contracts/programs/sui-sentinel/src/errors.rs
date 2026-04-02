use anchor_lang::prelude::*;

#[error_code]
pub enum SentinelError {
    #[msg("Unauthorized: caller is not the admin or owner")]
    Unauthorized,

    #[msg("Protocol is currently paused")]
    ProtocolPaused,

    #[msg("Enclave public key has not been set")]
    EnclaveNotSet,

    #[msg("Enclave public key has already been set, use update instead")]
    EnclaveAlreadySet,

    #[msg("Invalid fee ratios: must sum to 10000 basis points")]
    InvalidFeeRatios,

    #[msg("Invalid protocol wallet address")]
    InvalidProtocolWallet,

    #[msg("Max fee multiplier must be at least 10000 (1x)")]
    InvalidMaxFeeMultiplier,

    #[msg("Agent ID is too long (max 32 characters)")]
    AgentIdTooLong,

    #[msg("Agent has already been defeated")]
    AgentAlreadyDefeated,

    #[msg("Update window has expired (3 hours after creation)")]
    UpdateWindowExpired,

    #[msg("Withdrawal is still locked (14 days from last funding)")]
    WithdrawalLocked,

    #[msg("Insufficient balance for withdrawal")]
    InsufficientBalance,

    #[msg("Invalid attack: agent or attacker mismatch")]
    InvalidAttack,

    #[msg("Invalid signature: verification failed")]
    InvalidSignature,

    #[msg("Signature has expired")]
    SignatureExpired,

    #[msg("Signature timestamp is in the future")]
    SignatureInFuture,

    #[msg("Ed25519 program instruction not found")]
    Ed25519InstructionNotFound,

    #[msg("Invalid Ed25519 instruction data")]
    InvalidEd25519InstructionData,

    #[msg("Ed25519 signature verification failed")]
    Ed25519VerificationFailed,

    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,

    #[msg("Invalid instruction sysvar")]
    InvalidInstructionsSysvar,
}

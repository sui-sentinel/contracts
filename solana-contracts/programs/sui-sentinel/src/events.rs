use anchor_lang::prelude::*;

#[event]
pub struct ProtocolInitialized {
    pub admin: Pubkey,
    pub protocol_wallet: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EnclaveSet {
    pub enclave_pubkey: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct EnclaveUpdated {
    pub old_enclave_pubkey: [u8; 32],
    pub new_enclave_pubkey: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct FeeRatiosUpdated {
    pub agent_balance_fee: u64,
    pub creator_fee: u64,
    pub protocol_fee: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolWalletUpdated {
    pub old_wallet: Pubkey,
    pub new_wallet: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AdminTransferred {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DynamicFeeSettingsUpdated {
    pub fee_increase_bps: u64,
    pub max_fee_multiplier_bps: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolPaused {
    pub timestamp: i64,
}

#[event]
pub struct ProtocolUnpaused {
    pub timestamp: i64,
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub agent_id: String,
    pub owner: Pubkey,
    pub token_mint: Pubkey,
    pub cost_per_message: u64,
    pub timestamp: i64,
}

#[event]
pub struct AgentFunded {
    pub agent: Pubkey,
    pub agent_id: String,
    pub amount: u64,
    pub new_balance: u64,
    pub timestamp: i64,
}

#[event]
pub struct AgentCostUpdated {
    pub agent: Pubkey,
    pub agent_id: String,
    pub old_cost: u64,
    pub new_cost: u64,
    pub timestamp: i64,
}

#[event]
pub struct AgentPromptUpdated {
    pub agent: Pubkey,
    pub agent_id: String,
    pub timestamp: i64,
}

#[event]
pub struct FeesClaimed {
    pub agent: Pubkey,
    pub agent_id: String,
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct FundsWithdrawn {
    pub agent: Pubkey,
    pub agent_id: String,
    pub owner: Pubkey,
    pub amount: u64,
    pub remaining_balance: u64,
    pub timestamp: i64,
}

#[event]
pub struct AttackRequested {
    pub attack: Pubkey,
    pub agent: Pubkey,
    pub agent_id: String,
    pub attacker: Pubkey,
    pub paid_amount: u64,
    pub nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeeTransferred {
    pub agent: Pubkey,
    pub agent_id: String,
    pub attacker: Pubkey,
    pub total_amount: u64,
    pub creator_fee: u64,
    pub protocol_fee: u64,
    pub agent_balance_fee: u64,
    pub timestamp: i64,
}

#[event]
pub struct PromptConsumed {
    pub agent: Pubkey,
    pub agent_id: String,
    pub attacker: Pubkey,
    pub success: bool,
    pub score: u64,
    pub timestamp: i64,
}

#[event]
pub struct AgentDefeated {
    pub agent: Pubkey,
    pub agent_id: String,
    pub attacker: Pubkey,
    pub reward_amount: u64,
    pub timestamp: i64,
}

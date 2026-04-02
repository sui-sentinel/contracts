use anchor_lang::prelude::*;

/// Protocol configuration account - stores global settings
#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    /// Admin address that can update config
    pub admin: Pubkey,

    /// Protocol wallet that receives protocol fees
    pub protocol_wallet: Pubkey,

    /// Fee allocated to agent reward pool (in basis points)
    pub agent_balance_fee: u64,

    /// Fee allocated to agent creator (in basis points)
    pub creator_fee: u64,

    /// Fee allocated to protocol (in basis points)
    pub protocol_fee: u64,

    /// The canonical enclave public key (Ed25519, 32 bytes)
    /// Only signatures from this enclave are valid
    pub enclave_pubkey: Option<[u8; 32]>,

    /// Dynamic fee increase per attack (in basis points)
    /// Default: 100 (1% per attack)
    pub fee_increase_bps: u64,

    /// Maximum fee multiplier cap (in basis points)
    /// Default: 30000 (3x)
    pub max_fee_multiplier_bps: u64,

    /// Protocol pause flag
    pub is_paused: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Total agents registered
    pub total_agents: u64,
}

/// Agent account - represents an AI agent that can be attacked
#[account]
#[derive(InitSpace)]
pub struct Agent {
    /// Unique identifier for the agent
    #[max_len(32)]
    pub agent_id: String,

    /// Owner/creator of the agent
    pub owner: Pubkey,

    /// Token mint used for payments
    pub token_mint: Pubkey,

    /// Cost per message in token base units
    pub cost_per_message: u64,

    /// Hash of the AI system prompt (full prompt stored off-chain)
    pub prompt_hash: [u8; 32],

    /// Timestamp when agent was created
    pub created_at: i64,

    /// Timestamp when agent was last funded
    /// Used to calculate withdrawal lock period
    pub last_funded_timestamp: i64,

    /// Number of attacks received
    /// Used for dynamic fee calculation
    pub attack_count: u64,

    /// Whether the agent has been defeated
    pub is_defeated: bool,

    /// Bump seed for agent PDA
    pub bump: u8,

    /// Bump seed for agent vault PDA
    pub vault_bump: u8,

    /// Bump seed for agent fees vault PDA
    pub fees_vault_bump: u8,
}

/// Attack account - represents an ongoing attack
#[account]
#[derive(InitSpace)]
pub struct Attack {
    /// The agent being attacked
    pub agent: Pubkey,

    /// The attacker's address
    pub attacker: Pubkey,

    /// Amount paid for the attack
    pub paid_amount: u64,

    /// Random nonce for uniqueness
    pub nonce: u64,

    /// Timestamp when attack was initiated
    pub created_at: i64,

    /// Bump seed for PDA
    pub bump: u8,
}

impl ProtocolConfig {
    /// Check if fees sum to 100%
    pub fn validate_fee_ratios(&self) -> bool {
        self.agent_balance_fee + self.creator_fee + self.protocol_fee == 10000
    }
}

impl Agent {
    /// Calculate effective cost with dynamic fee multiplier
    pub fn calculate_effective_cost(&self, config: &ProtocolConfig) -> u64 {
        let raw_multiplier =
            10000u64.saturating_add(self.attack_count.saturating_mul(config.fee_increase_bps));

        let multiplier = raw_multiplier.min(config.max_fee_multiplier_bps);

        self.cost_per_message
            .saturating_mul(multiplier)
            .checked_div(10000)
            .unwrap_or(self.cost_per_message)
    }

    /// Check if withdrawal is locked
    pub fn is_withdrawal_locked(&self, current_time: i64, lock_period: i64) -> bool {
        current_time < self.last_funded_timestamp.saturating_add(lock_period)
    }

    /// Check if within update window
    pub fn is_within_update_window(&self, current_time: i64, window: i64) -> bool {
        current_time <= self.created_at.saturating_add(window)
    }
}

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("Di4JaK3QBbA869f6UNGYMef5RFcxxXyxTMiBymnMb5Gz");

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use errors::*;
pub use events::*;
pub use state::*;

/// Basis points constant (100% = 10000)
pub const BASIS_POINTS: u64 = 10000;

/// Default fee percentages in basis points
pub const DEFAULT_AGENT_BALANCE_FEE: u64 = 5000; // 50%
pub const DEFAULT_CREATOR_FEE: u64 = 4000; // 40%
pub const DEFAULT_PROTOCOL_FEE: u64 = 1000; // 10%

/// Default dynamic fee settings
pub const DEFAULT_FEE_INCREASE_BPS: u64 = 100; // 1% per attack
pub const DEFAULT_MAX_FEE_MULTIPLIER_BPS: u64 = 30000; // 3x max

/// Time constants
pub const WITHDRAWAL_LOCK_PERIOD: i64 = 14 * 24 * 60 * 60; // 14 days in seconds
pub const UPDATE_WINDOW: i64 = 3 * 60 * 60; // 3 hours in seconds
pub const SIGNATURE_MAX_AGE: i64 = 180; // 180 seconds

/// Intent scopes for signature verification
pub const SENTINEL_INTENT: u8 = 1;
pub const CONSUME_PROMPT_INTENT: u8 = 2;

#[program]
pub mod sui_sentinel {
    use super::*;

    /// Initialize the protocol configuration
    pub fn initialize(ctx: Context<Initialize>, protocol_wallet: Pubkey) -> Result<()> {
        instructions::initialize(ctx, protocol_wallet)
    }

    /// Set the canonical enclave public key (can only be called once)
    pub fn set_enclave_pubkey(ctx: Context<AdminOnly>, enclave_pubkey: [u8; 32]) -> Result<()> {
        instructions::set_enclave_pubkey(ctx, enclave_pubkey)
    }

    /// Update the canonical enclave public key
    pub fn update_enclave_pubkey(
        ctx: Context<AdminOnly>,
        new_enclave_pubkey: [u8; 32],
    ) -> Result<()> {
        instructions::update_enclave_pubkey(ctx, new_enclave_pubkey)
    }

    /// Update fee distribution ratios
    pub fn update_fee_ratios(
        ctx: Context<AdminOnly>,
        agent_balance_fee: u64,
        creator_fee: u64,
        protocol_fee: u64,
    ) -> Result<()> {
        instructions::update_fee_ratios(ctx, agent_balance_fee, creator_fee, protocol_fee)
    }

    /// Update the protocol wallet address
    pub fn update_protocol_wallet(ctx: Context<AdminOnly>, new_wallet: Pubkey) -> Result<()> {
        instructions::update_protocol_wallet(ctx, new_wallet)
    }

    /// Transfer admin role to a new address
    pub fn transfer_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> {
        instructions::transfer_admin(ctx, new_admin)
    }

    /// Update dynamic fee settings
    pub fn update_dynamic_fee_settings(
        ctx: Context<AdminOnly>,
        fee_increase_bps: u64,
        max_fee_multiplier_bps: u64,
    ) -> Result<()> {
        instructions::update_dynamic_fee_settings(ctx, fee_increase_bps, max_fee_multiplier_bps)
    }

    /// Pause the protocol
    pub fn pause_protocol(ctx: Context<AdminOnly>) -> Result<()> {
        instructions::pause_protocol(ctx)
    }

    /// Unpause the protocol
    pub fn unpause_protocol(ctx: Context<AdminOnly>) -> Result<()> {
        instructions::unpause_protocol(ctx)
    }

    /// Register a new agent with enclave signature verification
    /// Note: Call init_agent_vaults after this to create vault accounts
    #[inline(never)]
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_id: String,
        cost_per_message: u64,
        prompt_hash: [u8; 32],
        timestamp: i64,
        signature: Vec<u8>,
    ) -> Result<()> {
        instructions::register_agent(
            ctx,
            agent_id,
            cost_per_message,
            &prompt_hash,
            timestamp,
            signature,
        )
    }

    /// Initialize agent vault accounts (must be called after register_agent)
    pub fn init_agent_vaults(ctx: Context<InitAgentVaults>) -> Result<()> {
        instructions::init_agent_vaults(ctx)
    }

    /// Fund an agent's reward pool
    pub fn fund_agent(ctx: Context<FundAgent>, amount: u64) -> Result<()> {
        instructions::fund_agent(ctx, amount)
    }

    /// Update agent cost (within 3 hour window)
    pub fn update_agent_cost(ctx: Context<UpdateAgent>, new_cost: u64) -> Result<()> {
        instructions::update_agent_cost(ctx, new_cost)
    }

    /// Update agent prompt hash (within 3 hour window)
    pub fn update_agent_prompt_hash(
        ctx: Context<UpdateAgent>,
        new_prompt_hash: [u8; 32],
    ) -> Result<()> {
        instructions::update_agent_prompt_hash(ctx, new_prompt_hash)
    }

    /// Claim accumulated creator fees
    pub fn claim_fees(ctx: Context<ClaimFees>) -> Result<()> {
        instructions::claim_fees(ctx)
    }

    /// Withdraw from agent balance (after lock period)
    pub fn withdraw_from_agent(ctx: Context<WithdrawFromAgent>, amount: u64) -> Result<()> {
        instructions::withdraw_from_agent(ctx, amount)
    }

    /// Request an attack on an agent
    pub fn request_attack(ctx: Context<RequestAttack>, nonce: u64) -> Result<()> {
        instructions::request_attack(ctx, nonce)
    }

    /// Consume prompt with enclave signature verification
    pub fn consume_prompt(
        ctx: Context<ConsumePrompt>,
        success: bool,
        score: u64,
        message_hash: [u8; 32],
        timestamp: i64,
        signature: [u8; 64],
    ) -> Result<()> {
        instructions::consume_prompt(ctx, success, score, message_hash, timestamp, signature)
    }
}

// ============================================================================
// Account Contexts
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        constraint = protocol_config.admin == admin.key() @ SentinelError::Unauthorized
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub admin: Signer<'info>,
}

/// Register agent - Step 1: Create agent account and verify signature
/// Note: Vault accounts are created separately via InitAgentVaults
#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct RegisterAgent<'info> {
    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        constraint = !protocol_config.is_paused @ SentinelError::ProtocolPaused,
        constraint = protocol_config.enclave_pubkey.is_some() @ SentinelError::EnclaveNotSet
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        init,
        payer = creator,
        space = 8 + Agent::INIT_SPACE,
        seeds = [b"agent", agent_id.as_bytes()],
        bump
    )]
    pub agent: Box<Account<'info, Agent>>,

    /// The token mint for this agent
    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Instructions sysvar for Ed25519 signature verification
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

/// Register agent - Step 2: Initialize vault accounts
#[derive(Accounts)]
pub struct InitAgentVaults<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.agent_id.as_bytes()],
        bump = agent.bump,
        constraint = agent.vault_bump == 0 @ SentinelError::VaultsAlreadyInitialized
    )]
    pub agent: Box<Account<'info, Agent>>,

    /// CHECK: The token mint for this agent - validated in instruction
    pub token_mint: UncheckedAccount<'info>,

    /// Agent's token account for holding rewards
    #[account(
        init,
        payer = payer,
        token::mint = token_mint,
        token::authority = agent,
        seeds = [b"agent_vault", agent.key().as_ref()],
        bump
    )]
    pub agent_vault: Box<Account<'info, TokenAccount>>,

    /// Agent's token account for accumulated fees
    #[account(
        init,
        payer = payer,
        token::mint = token_mint,
        token::authority = agent,
        seeds = [b"agent_fees", agent.key().as_ref()],
        bump
    )]
    pub agent_fees_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.agent_id.as_bytes()],
        bump = agent.bump,
        constraint = agent.owner == owner.key() @ SentinelError::Unauthorized
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [b"agent_vault", agent.key().as_ref()],
        bump = agent.vault_bump
    )]
    pub agent_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key(),
        constraint = owner_token_account.mint == agent.token_mint
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.agent_id.as_bytes()],
        bump = agent.bump,
        constraint = agent.owner == owner.key() @ SentinelError::Unauthorized
    )]
    pub agent: Account<'info, Agent>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimFees<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.agent_id.as_bytes()],
        bump = agent.bump,
        constraint = agent.owner == owner.key() @ SentinelError::Unauthorized
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [b"agent_fees", agent.key().as_ref()],
        bump = agent.fees_vault_bump
    )]
    pub agent_fees_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key(),
        constraint = owner_token_account.mint == agent.token_mint
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawFromAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.agent_id.as_bytes()],
        bump = agent.bump,
        constraint = agent.owner == owner.key() @ SentinelError::Unauthorized
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [b"agent_vault", agent.key().as_ref()],
        bump = agent.vault_bump
    )]
    pub agent_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key(),
        constraint = owner_token_account.mint == agent.token_mint
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct RequestAttack<'info> {
    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        constraint = !protocol_config.is_paused @ SentinelError::ProtocolPaused
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        mut,
        seeds = [b"agent", agent.agent_id.as_bytes()],
        bump = agent.bump
    )]
    pub agent: Box<Account<'info, Agent>>,

    #[account(
        mut,
        seeds = [b"agent_vault", agent.key().as_ref()],
        bump = agent.vault_bump
    )]
    pub agent_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"agent_fees", agent.key().as_ref()],
        bump = agent.fees_vault_bump
    )]
    pub agent_fees_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = attacker,
        space = 8 + Attack::INIT_SPACE,
        seeds = [b"attack", agent.key().as_ref(), attacker.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub attack: Box<Account<'info, Attack>>,

    #[account(
        mut,
        constraint = attacker_token_account.owner == attacker.key(),
        constraint = attacker_token_account.mint == agent.token_mint
    )]
    pub attacker_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Protocol wallet receives protocol fees
    #[account(
        mut,
        constraint = protocol_wallet.key() == protocol_config.protocol_wallet @ SentinelError::InvalidProtocolWallet
    )]
    pub protocol_wallet: AccountInfo<'info>,

    /// Protocol wallet's token account
    #[account(
        mut,
        constraint = protocol_wallet_token_account.owner == protocol_config.protocol_wallet,
        constraint = protocol_wallet_token_account.mint == agent.token_mint
    )]
    pub protocol_wallet_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub attacker: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConsumePrompt<'info> {
    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        constraint = !protocol_config.is_paused @ SentinelError::ProtocolPaused,
        constraint = protocol_config.enclave_pubkey.is_some() @ SentinelError::EnclaveNotSet
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        mut,
        seeds = [b"agent", agent.agent_id.as_bytes()],
        bump = agent.bump
    )]
    pub agent: Box<Account<'info, Agent>>,

    #[account(
        mut,
        seeds = [b"agent_vault", agent.key().as_ref()],
        bump = agent.vault_bump
    )]
    pub agent_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        close = attacker,
        seeds = [b"attack", agent.key().as_ref(), attacker.key().as_ref(), &attack.nonce.to_le_bytes()],
        bump = attack.bump,
        constraint = attack.agent == agent.key() @ SentinelError::InvalidAttack,
        constraint = attack.attacker == attacker.key() @ SentinelError::InvalidAttack
    )]
    pub attack: Box<Account<'info, Attack>>,

    #[account(
        mut,
        constraint = attacker_token_account.owner == attacker.key(),
        constraint = attacker_token_account.mint == agent.token_mint
    )]
    pub attacker_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub attacker: Signer<'info>,

    pub token_program: Program<'info, Token>,

    /// CHECK: Instructions sysvar for Ed25519 signature verification
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

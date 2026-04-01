use super::signature::verify_ed25519_signature;
use crate::{
    errors::SentinelError, events::*, ClaimFees, FundAgent, RegisterAgent, UpdateAgent,
    WithdrawFromAgent, SENTINEL_INTENT, UPDATE_WINDOW, WITHDRAWAL_LOCK_PERIOD,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

/// Register a new agent with enclave signature verification
pub fn register_agent(
    ctx: Context<RegisterAgent>,
    agent_id: String,
    cost_per_message: u64,
    system_prompt: String,
    timestamp: i64,
    signature: [u8; 64],
) -> Result<()> {
    // Validate input lengths
    require!(agent_id.len() <= 64, SentinelError::AgentIdTooLong);
    require!(
        system_prompt.len() <= 2048,
        SentinelError::SystemPromptTooLong
    );

    let clock = Clock::get()?;
    let config = &ctx.accounts.protocol_config;

    // Get the enclave public key
    let enclave_pubkey = config.enclave_pubkey.ok_or(SentinelError::EnclaveNotSet)?;

    // Build the message to verify
    // Message format: intent || timestamp || agent_id || cost_per_message || system_prompt_hash || creator
    let system_prompt_hash = anchor_lang::solana_program::hash::hash(system_prompt.as_bytes());
    let mut message = Vec::new();
    message.push(SENTINEL_INTENT);
    message.extend_from_slice(&timestamp.to_le_bytes());
    message.extend_from_slice(agent_id.as_bytes());
    message.extend_from_slice(&cost_per_message.to_le_bytes());
    message.extend_from_slice(system_prompt_hash.as_ref());
    message.extend_from_slice(ctx.accounts.creator.key().as_ref());

    // Verify the signature
    verify_ed25519_signature(
        &ctx.accounts.instructions_sysvar,
        &enclave_pubkey,
        &message,
        &signature,
        timestamp,
        clock.unix_timestamp,
    )?;

    // Capture keys before mutable borrow
    let agent_key = ctx.accounts.agent.key();
    let creator_key = ctx.accounts.creator.key();
    let token_mint_key = ctx.accounts.token_mint.key();

    // Initialize the agent
    let agent = &mut ctx.accounts.agent;
    agent.agent_id = agent_id.clone();
    agent.owner = creator_key;
    agent.token_mint = token_mint_key;
    agent.cost_per_message = cost_per_message;
    agent.system_prompt = system_prompt;
    agent.created_at = clock.unix_timestamp;
    agent.last_funded_timestamp = clock.unix_timestamp; // Set to current time to start lock
    agent.attack_count = 0;
    agent.is_defeated = false;
    agent.bump = ctx.bumps.agent;
    agent.vault_bump = ctx.bumps.agent_vault;
    agent.fees_vault_bump = ctx.bumps.agent_fees_vault;
    agent._reserved = vec![];

    emit!(AgentRegistered {
        agent: agent_key,
        agent_id,
        owner: creator_key,
        token_mint: token_mint_key,
        cost_per_message,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Fund an agent's reward pool
pub fn fund_agent(ctx: Context<FundAgent>, amount: u64) -> Result<()> {
    let clock = Clock::get()?;

    // Capture keys before mutable borrow
    let agent_key = ctx.accounts.agent.key();
    let agent_id = ctx.accounts.agent.agent_id.clone();

    // Transfer tokens from owner to agent vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_token_account.to_account_info(),
        to: ctx.accounts.agent_vault.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update last funded timestamp (resets withdrawal lock)
    let agent = &mut ctx.accounts.agent;
    agent.last_funded_timestamp = clock.unix_timestamp;

    let new_balance = ctx.accounts.agent_vault.amount + amount;

    emit!(AgentFunded {
        agent: agent_key,
        agent_id,
        amount,
        new_balance,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Update agent cost (within 3 hour window)
pub fn update_agent_cost(ctx: Context<UpdateAgent>, new_cost: u64) -> Result<()> {
    let clock = Clock::get()?;

    // Capture keys before mutable borrow
    let agent_key = ctx.accounts.agent.key();
    let agent_id = ctx.accounts.agent.agent_id.clone();
    let old_cost = ctx.accounts.agent.cost_per_message;
    let created_at = ctx.accounts.agent.created_at;

    // Check update window
    require!(
        clock.unix_timestamp <= created_at.saturating_add(UPDATE_WINDOW),
        SentinelError::UpdateWindowExpired
    );

    let agent = &mut ctx.accounts.agent;
    agent.cost_per_message = new_cost;

    emit!(AgentCostUpdated {
        agent: agent_key,
        agent_id,
        old_cost,
        new_cost,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Update agent system prompt (within 3 hour window)
pub fn update_agent_prompt(ctx: Context<UpdateAgent>, new_prompt: String) -> Result<()> {
    let clock = Clock::get()?;

    // Validate prompt length
    require!(new_prompt.len() <= 2048, SentinelError::SystemPromptTooLong);

    // Capture keys before mutable borrow
    let agent_key = ctx.accounts.agent.key();
    let agent_id = ctx.accounts.agent.agent_id.clone();
    let created_at = ctx.accounts.agent.created_at;

    // Check update window
    require!(
        clock.unix_timestamp <= created_at.saturating_add(UPDATE_WINDOW),
        SentinelError::UpdateWindowExpired
    );

    let agent = &mut ctx.accounts.agent;
    agent.system_prompt = new_prompt;

    emit!(AgentPromptUpdated {
        agent: agent_key,
        agent_id,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Claim accumulated creator fees
pub fn claim_fees(ctx: Context<ClaimFees>) -> Result<()> {
    let clock = Clock::get()?;
    let agent = &ctx.accounts.agent;

    let amount = ctx.accounts.agent_fees_vault.amount;

    if amount == 0 {
        return Ok(());
    }

    // Capture data for event
    let agent_key = ctx.accounts.agent.key();
    let agent_id = agent.agent_id.clone();
    let owner_key = ctx.accounts.owner.key();

    // Create signer seeds for the agent PDA
    let agent_id_bytes = agent.agent_id.as_bytes();
    let bump = agent.bump;
    let seeds = &[b"agent".as_ref(), agent_id_bytes, &[bump]];
    let signer_seeds = &[&seeds[..]];

    // Transfer fees to owner
    let cpi_accounts = Transfer {
        from: ctx.accounts.agent_fees_vault.to_account_info(),
        to: ctx.accounts.owner_token_account.to_account_info(),
        authority: ctx.accounts.agent.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    token::transfer(cpi_ctx, amount)?;

    emit!(FeesClaimed {
        agent: agent_key,
        agent_id,
        owner: owner_key,
        amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Withdraw from agent balance (after lock period)
pub fn withdraw_from_agent(ctx: Context<WithdrawFromAgent>, amount: u64) -> Result<()> {
    let clock = Clock::get()?;
    let agent = &ctx.accounts.agent;

    // Check withdrawal lock period
    require!(
        !agent.is_withdrawal_locked(clock.unix_timestamp, WITHDRAWAL_LOCK_PERIOD),
        SentinelError::WithdrawalLocked
    );

    // Check sufficient balance
    require!(
        ctx.accounts.agent_vault.amount >= amount,
        SentinelError::InsufficientBalance
    );

    // Capture data for event
    let agent_key = ctx.accounts.agent.key();
    let agent_id = agent.agent_id.clone();
    let owner_key = ctx.accounts.owner.key();

    // Create signer seeds for the agent PDA
    let agent_id_bytes = agent.agent_id.as_bytes();
    let bump = agent.bump;
    let seeds = &[b"agent".as_ref(), agent_id_bytes, &[bump]];
    let signer_seeds = &[&seeds[..]];

    // Transfer from agent vault to owner
    let cpi_accounts = Transfer {
        from: ctx.accounts.agent_vault.to_account_info(),
        to: ctx.accounts.owner_token_account.to_account_info(),
        authority: ctx.accounts.agent.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    token::transfer(cpi_ctx, amount)?;

    let remaining_balance = ctx.accounts.agent_vault.amount - amount;

    emit!(FundsWithdrawn {
        agent: agent_key,
        agent_id,
        owner: owner_key,
        amount,
        remaining_balance,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

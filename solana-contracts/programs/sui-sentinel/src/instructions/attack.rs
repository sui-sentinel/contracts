use super::signature::verify_ed25519_signature;
use crate::{
    errors::SentinelError, events::*, ConsumePrompt, RequestAttack, BASIS_POINTS,
    CONSUME_PROMPT_INTENT, WITHDRAWAL_LOCK_PERIOD,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

/// Request an attack on an agent
pub fn request_attack(ctx: Context<RequestAttack>, nonce: u64) -> Result<()> {
    let clock = Clock::get()?;
    let config = &ctx.accounts.protocol_config;

    // Capture data before mutable borrow
    let agent_key = ctx.accounts.agent.key();
    let agent_id = ctx.accounts.agent.agent_id.clone();
    let attacker_key = ctx.accounts.attacker.key();
    let attack_key = ctx.accounts.attack.key();
    let is_defeated = ctx.accounts.agent.is_defeated;
    let last_funded_timestamp = ctx.accounts.agent.last_funded_timestamp;
    let cost_per_message = ctx.accounts.agent.cost_per_message;
    let attack_count = ctx.accounts.agent.attack_count;

    // Ensure agent is not defeated
    require!(!is_defeated, SentinelError::AgentAlreadyDefeated);

    // Ensure withdrawal is locked (prevents owner from draining during attack)
    let is_locked =
        clock.unix_timestamp < last_funded_timestamp.saturating_add(WITHDRAWAL_LOCK_PERIOD);
    require!(is_locked, SentinelError::WithdrawalLocked);

    // Calculate effective cost with dynamic fee
    let raw_multiplier =
        10000u64.saturating_add(attack_count.saturating_mul(config.fee_increase_bps));
    let multiplier = raw_multiplier.min(config.max_fee_multiplier_bps);
    let effective_cost = cost_per_message
        .saturating_mul(multiplier)
        .checked_div(10000)
        .unwrap_or(cost_per_message);

    // Calculate fee distribution
    let creator_fee_amount = effective_cost
        .checked_mul(config.creator_fee)
        .ok_or(SentinelError::ArithmeticOverflow)?
        .checked_div(BASIS_POINTS)
        .ok_or(SentinelError::ArithmeticOverflow)?;

    let protocol_fee_amount = effective_cost
        .checked_mul(config.protocol_fee)
        .ok_or(SentinelError::ArithmeticOverflow)?
        .checked_div(BASIS_POINTS)
        .ok_or(SentinelError::ArithmeticOverflow)?;

    let agent_balance_amount = effective_cost
        .checked_sub(creator_fee_amount)
        .ok_or(SentinelError::ArithmeticOverflow)?
        .checked_sub(protocol_fee_amount)
        .ok_or(SentinelError::ArithmeticOverflow)?;

    // Transfer creator fee to agent fees vault
    let cpi_accounts_creator = Transfer {
        from: ctx.accounts.attacker_token_account.to_account_info(),
        to: ctx.accounts.agent_fees_vault.to_account_info(),
        authority: ctx.accounts.attacker.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new(cpi_program.clone(), cpi_accounts_creator),
        creator_fee_amount,
    )?;

    // Transfer protocol fee to protocol wallet
    let cpi_accounts_protocol = Transfer {
        from: ctx.accounts.attacker_token_account.to_account_info(),
        to: ctx.accounts.protocol_wallet_token_account.to_account_info(),
        authority: ctx.accounts.attacker.to_account_info(),
    };
    token::transfer(
        CpiContext::new(cpi_program.clone(), cpi_accounts_protocol),
        protocol_fee_amount,
    )?;

    // Transfer agent balance fee to agent vault (reward pool)
    let cpi_accounts_agent = Transfer {
        from: ctx.accounts.attacker_token_account.to_account_info(),
        to: ctx.accounts.agent_vault.to_account_info(),
        authority: ctx.accounts.attacker.to_account_info(),
    };
    token::transfer(
        CpiContext::new(cpi_program, cpi_accounts_agent),
        agent_balance_amount,
    )?;

    // Increment attack count for dynamic fee calculation
    let agent = &mut ctx.accounts.agent;
    agent.attack_count = agent.attack_count.saturating_add(1);

    // Initialize attack account
    let attack = &mut ctx.accounts.attack;
    attack.agent = agent_key;
    attack.attacker = attacker_key;
    attack.paid_amount = effective_cost;
    attack.nonce = nonce;
    attack.created_at = clock.unix_timestamp;
    attack.bump = ctx.bumps.attack;

    emit!(AttackRequested {
        attack: attack_key,
        agent: agent_key,
        agent_id: agent_id.clone(),
        attacker: attacker_key,
        paid_amount: effective_cost,
        nonce,
        timestamp: clock.unix_timestamp,
    });

    emit!(FeeTransferred {
        agent: agent_key,
        agent_id,
        attacker: attacker_key,
        total_amount: effective_cost,
        creator_fee: creator_fee_amount,
        protocol_fee: protocol_fee_amount,
        agent_balance_fee: agent_balance_amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
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
    let clock = Clock::get()?;
    let config = &ctx.accounts.protocol_config;
    let attack = &ctx.accounts.attack;

    // Capture data before mutable borrow
    let agent_key = ctx.accounts.agent.key();
    let agent_id = ctx.accounts.agent.agent_id.clone();
    let attacker_key = ctx.accounts.attacker.key();
    let agent_bump = ctx.accounts.agent.bump;

    // Get enclave public key
    let enclave_pubkey = config.enclave_pubkey.ok_or(SentinelError::EnclaveNotSet)?;

    // Build the message to verify
    // Message format: intent || timestamp || agent_id || success || score || attacker || nonce || message_hash
    let mut message = Vec::new();
    message.push(CONSUME_PROMPT_INTENT);
    message.extend_from_slice(&timestamp.to_le_bytes());
    message.extend_from_slice(agent_id.as_bytes());
    message.push(if success { 1 } else { 0 });
    message.extend_from_slice(&score.to_le_bytes());
    message.extend_from_slice(attack.attacker.as_ref());
    message.extend_from_slice(&attack.nonce.to_le_bytes());
    message.extend_from_slice(&message_hash);

    // Verify the signature
    verify_ed25519_signature(
        &ctx.accounts.instructions_sysvar,
        &enclave_pubkey,
        &message,
        &signature,
        timestamp,
        clock.unix_timestamp,
    )?;

    emit!(PromptConsumed {
        attack: ctx.accounts.attack.key(),
        agent: agent_key,
        agent_id: agent_id.clone(),
        attacker: attacker_key,
        success,
        score,
        timestamp: clock.unix_timestamp,
    });

    // If attack was successful, transfer reward to attacker
    if success {
        let reward_amount = ctx.accounts.agent_vault.amount;

        if reward_amount > 0 {
            // Create signer seeds for the agent PDA
            let agent_id_bytes = agent_id.as_bytes();
            let seeds = &[b"agent".as_ref(), agent_id_bytes, &[agent_bump]];
            let signer_seeds = &[&seeds[..]];

            // Transfer entire vault balance to attacker
            let cpi_accounts = Transfer {
                from: ctx.accounts.agent_vault.to_account_info(),
                to: ctx.accounts.attacker_token_account.to_account_info(),
                authority: ctx.accounts.agent.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
            token::transfer(cpi_ctx, reward_amount)?;

            // Mark agent as defeated
            let agent = &mut ctx.accounts.agent;
            agent.is_defeated = true;

            emit!(AgentDefeated {
                agent: agent_key,
                agent_id,
                attacker: attacker_key,
                reward_amount,
                timestamp: clock.unix_timestamp,
            });
        }
    }

    // Attack account is closed automatically via the `close = attacker` constraint
    // which returns the rent to the attacker

    Ok(())
}

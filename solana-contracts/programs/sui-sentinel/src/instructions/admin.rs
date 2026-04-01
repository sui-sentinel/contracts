use crate::{
    errors::SentinelError, events::*, AdminOnly, Initialize, DEFAULT_AGENT_BALANCE_FEE,
    DEFAULT_CREATOR_FEE, DEFAULT_FEE_INCREASE_BPS, DEFAULT_MAX_FEE_MULTIPLIER_BPS,
    DEFAULT_PROTOCOL_FEE,
};
use anchor_lang::prelude::*;

/// Initialize the protocol configuration
pub fn initialize(ctx: Context<Initialize>, protocol_wallet: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    config.admin = ctx.accounts.admin.key();
    config.protocol_wallet = protocol_wallet;
    config.agent_balance_fee = DEFAULT_AGENT_BALANCE_FEE;
    config.creator_fee = DEFAULT_CREATOR_FEE;
    config.protocol_fee = DEFAULT_PROTOCOL_FEE;
    config.enclave_pubkey = None;
    config.fee_increase_bps = DEFAULT_FEE_INCREASE_BPS;
    config.max_fee_multiplier_bps = DEFAULT_MAX_FEE_MULTIPLIER_BPS;
    config.is_paused = false;
    config.bump = ctx.bumps.protocol_config;
    config.total_agents = 0;
    config._reserved = vec![];

    emit!(ProtocolInitialized {
        admin: config.admin,
        protocol_wallet: config.protocol_wallet,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Set the canonical enclave public key (one-time)
pub fn set_enclave_pubkey(ctx: Context<AdminOnly>, enclave_pubkey: [u8; 32]) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    require!(
        config.enclave_pubkey.is_none(),
        SentinelError::EnclaveAlreadySet
    );

    config.enclave_pubkey = Some(enclave_pubkey);

    emit!(EnclaveSet {
        enclave_pubkey,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Update the canonical enclave public key
pub fn update_enclave_pubkey(ctx: Context<AdminOnly>, new_enclave_pubkey: [u8; 32]) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    let old_enclave_pubkey = config.enclave_pubkey.ok_or(SentinelError::EnclaveNotSet)?;

    config.enclave_pubkey = Some(new_enclave_pubkey);

    emit!(EnclaveUpdated {
        old_enclave_pubkey,
        new_enclave_pubkey,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Update fee distribution ratios
pub fn update_fee_ratios(
    ctx: Context<AdminOnly>,
    agent_balance_fee: u64,
    creator_fee: u64,
    protocol_fee: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    // Validate that fees sum to 100%
    require!(
        agent_balance_fee + creator_fee + protocol_fee == 10000,
        SentinelError::InvalidFeeRatios
    );

    config.agent_balance_fee = agent_balance_fee;
    config.creator_fee = creator_fee;
    config.protocol_fee = protocol_fee;

    emit!(FeeRatiosUpdated {
        agent_balance_fee,
        creator_fee,
        protocol_fee,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Update the protocol wallet address
pub fn update_protocol_wallet(ctx: Context<AdminOnly>, new_wallet: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    let old_wallet = config.protocol_wallet;
    config.protocol_wallet = new_wallet;

    emit!(ProtocolWalletUpdated {
        old_wallet,
        new_wallet,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Transfer admin role to a new address
pub fn transfer_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    let old_admin = config.admin;
    config.admin = new_admin;

    emit!(AdminTransferred {
        old_admin,
        new_admin,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Update dynamic fee settings
pub fn update_dynamic_fee_settings(
    ctx: Context<AdminOnly>,
    fee_increase_bps: u64,
    max_fee_multiplier_bps: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    // Max multiplier must be at least 1x (10000 bps)
    require!(
        max_fee_multiplier_bps >= 10000,
        SentinelError::InvalidMaxFeeMultiplier
    );

    config.fee_increase_bps = fee_increase_bps;
    config.max_fee_multiplier_bps = max_fee_multiplier_bps;

    emit!(DynamicFeeSettingsUpdated {
        fee_increase_bps,
        max_fee_multiplier_bps,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Pause the protocol
pub fn pause_protocol(ctx: Context<AdminOnly>) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    config.is_paused = true;

    emit!(ProtocolPaused {
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Unpause the protocol
pub fn unpause_protocol(ctx: Context<AdminOnly>) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let clock = Clock::get()?;

    config.is_paused = false;

    emit!(ProtocolUnpaused {
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

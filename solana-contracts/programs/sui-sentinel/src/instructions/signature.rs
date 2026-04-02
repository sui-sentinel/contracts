use crate::errors::SentinelError;
use crate::SIGNATURE_MAX_AGE;
use anchor_lang::prelude::*;
use solana_program::ed25519_program;
use solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};

/// Verify an Ed25519 signature using the native Ed25519 program
///
/// This function expects that the transaction includes an Ed25519 signature verification
/// instruction BEFORE this program's instruction. The Ed25519 program instruction format is:
///
/// - 1 byte: number of signatures (must be 1)
/// - 1 byte: padding
/// - 2 bytes: signature offset
/// - 2 bytes: signature instruction index
/// - 2 bytes: public key offset
/// - 2 bytes: public key instruction index
/// - 2 bytes: message data offset
/// - 2 bytes: message data size
/// - 2 bytes: message instruction index
/// - [signature]: 64 bytes
/// - [public key]: 32 bytes
/// - [message]: variable length
#[inline(never)]
pub fn verify_ed25519_signature(
    instructions_sysvar: &AccountInfo,
    expected_pubkey: &[u8; 32],
    expected_message: &[u8],
    expected_signature: &[u8; 64],
    signature_timestamp: i64,
    current_timestamp: i64,
) -> Result<()> {
    // Validate timestamp
    require!(
        signature_timestamp <= current_timestamp,
        SentinelError::SignatureInFuture
    );
    require!(
        current_timestamp - signature_timestamp <= SIGNATURE_MAX_AGE,
        SentinelError::SignatureExpired
    );

    // Get current instruction index
    let current_index = load_current_index_checked(instructions_sysvar)
        .map_err(|_| SentinelError::InvalidInstructionsSysvar)?;

    // The Ed25519 instruction must be immediately before our instruction
    if current_index == 0 {
        return Err(SentinelError::Ed25519InstructionNotFound.into());
    }

    let ed25519_ix_index = current_index - 1;

    // Load the Ed25519 instruction and box it immediately to reduce stack pressure
    let ed25519_ix = load_instruction_at_checked(ed25519_ix_index as usize, instructions_sysvar)
        .map_err(|_| SentinelError::Ed25519InstructionNotFound)?;

    // Verify it's from the Ed25519 program
    if ed25519_ix.program_id != ed25519_program::ID {
        return Err(SentinelError::Ed25519InstructionNotFound.into());
    }

    // Parse and validate the Ed25519 instruction data
    // Use a reference to avoid copying
    let ix_data = ed25519_ix.data.as_slice();

    // Minimum length check: 2 bytes header + 14 bytes offsets + 64 signature + 32 pubkey = 112
    require!(
        ix_data.len() >= 112,
        SentinelError::InvalidEd25519InstructionData
    );

    // Check number of signatures (must be 1)
    require!(
        ix_data[0] == 1,
        SentinelError::InvalidEd25519InstructionData
    );

    // Parse offsets (all offsets are relative to instruction data start)
    let signature_offset = u16::from_le_bytes([ix_data[2], ix_data[3]]) as usize;
    let pubkey_offset = u16::from_le_bytes([ix_data[6], ix_data[7]]) as usize;
    let message_offset = u16::from_le_bytes([ix_data[10], ix_data[11]]) as usize;
    let message_size = u16::from_le_bytes([ix_data[12], ix_data[13]]) as usize;

    // Validate offsets are within bounds
    require!(
        signature_offset + 64 <= ix_data.len(),
        SentinelError::InvalidEd25519InstructionData
    );
    require!(
        pubkey_offset + 32 <= ix_data.len(),
        SentinelError::InvalidEd25519InstructionData
    );
    require!(
        message_offset + message_size <= ix_data.len(),
        SentinelError::InvalidEd25519InstructionData
    );

    // Extract and verify signature
    let signature = &ix_data[signature_offset..signature_offset + 64];
    require!(
        signature == expected_signature,
        SentinelError::InvalidSignature
    );

    // Extract and verify public key
    let pubkey = &ix_data[pubkey_offset..pubkey_offset + 32];
    require!(pubkey == expected_pubkey, SentinelError::InvalidSignature);

    // Extract and verify message
    let message = &ix_data[message_offset..message_offset + message_size];
    require!(message == expected_message, SentinelError::InvalidSignature);

    // If we get here, the Ed25519 program has verified the signature
    // and we've confirmed the parameters match our expectations
    Ok(())
}

/// Build the message for register agent verification
#[inline(never)]
pub fn build_register_agent_message(
    intent: u8,
    timestamp: i64,
    agent_id: &str,
    cost_per_message: u64,
    system_prompt_hash: &[u8; 32],
    creator: &Pubkey,
) -> Vec<u8> {
    let mut message = Vec::with_capacity(1 + 8 + agent_id.len() + 8 + 32 + 32);
    message.push(intent);
    message.extend_from_slice(&timestamp.to_le_bytes());
    message.extend_from_slice(agent_id.as_bytes());
    message.extend_from_slice(&cost_per_message.to_le_bytes());
    message.extend_from_slice(system_prompt_hash);
    message.extend_from_slice(creator.as_ref());
    message
}

/// Build the message for consume prompt verification
#[inline(never)]
pub fn build_consume_prompt_message(
    intent: u8,
    timestamp: i64,
    agent_id: &str,
    success: bool,
    score: u64,
    attacker: &Pubkey,
    nonce: u64,
    message_hash: &[u8; 32],
) -> Vec<u8> {
    let mut message = Vec::with_capacity(1 + 8 + agent_id.len() + 1 + 8 + 32 + 8 + 32);
    message.push(intent);
    message.extend_from_slice(&timestamp.to_le_bytes());
    message.extend_from_slice(agent_id.as_bytes());
    message.push(if success { 1 } else { 0 });
    message.extend_from_slice(&score.to_le_bytes());
    message.extend_from_slice(attacker.as_ref());
    message.extend_from_slice(&nonce.to_le_bytes());
    message.extend_from_slice(message_hash);
    message
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_register_agent_message() {
        let intent = 1u8;
        let timestamp = 1234567890i64;
        let agent_id = "test_agent";
        let cost = 1000u64;
        let prompt_hash = [0u8; 32];
        let creator = Pubkey::new_unique();

        let message =
            build_register_agent_message(intent, timestamp, agent_id, cost, &prompt_hash, &creator);

        assert_eq!(message[0], intent);
        assert_eq!(
            i64::from_le_bytes(message[1..9].try_into().unwrap()),
            timestamp
        );
    }

    #[test]
    fn test_build_consume_prompt_message() {
        let intent = 2u8;
        let timestamp = 1234567890i64;
        let agent_id = "test_agent";
        let success = true;
        let score = 100u64;
        let attacker = Pubkey::new_unique();
        let nonce = 42u64;
        let message_hash = [1u8; 32];

        let message = build_consume_prompt_message(
            intent,
            timestamp,
            agent_id,
            success,
            score,
            &attacker,
            nonce,
            &message_hash,
        );

        assert_eq!(message[0], intent);
        assert_eq!(
            i64::from_le_bytes(message[1..9].try_into().unwrap()),
            timestamp
        );
    }
}

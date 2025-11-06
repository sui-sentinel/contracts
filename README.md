# SUI Sentinel Contracts

Sui Sentinel is fun-economic gameplay between defenders and attackers. It's a high-stakes game where two roles collide:

**Defenders**: Users who deploy AI agents, known as 'Sentinels'. They fund their Sentinel with assets like SUI and USDC and craft a unique set of instructions to guard the vault.

**Attackers**: Users who try to socially engineer, "jailbreak," or persuade a Defender's Sentinel into surrendering its funds through clever conversation and prompting.


Step 1 – Pay fee on-chain
User calls request_challenge(agent_id) and pays the fee.
The Move contract emits an event containing:

agent_id

fee_payer

nonce

timestamp

and stores a ChallengeToken object.

Step 2 – Off-chain TEE call
The frontend sends this nonce and fee_payer to your TEE endpoint.
The TEE checks that the nonce and fee payment exist on-chain (via Sui RPC), then evaluates the prompt, and signs {agent_id, requester, nonce, score, success, explanation}.

Step 3 – Claim result
The user calls consume_prompt with that signed response and the ChallengeToken object.
Contract verifies:

signature validity,

the token wasn’t used before,

and then burns the token and distributes reward.

# SUI Sentinel Contracts

Sui Sentinel is fun-economic gameplay between defenders and attackers. It's a high-stakes game where two roles collide:

**Defenders**: Users who deploy AI agents, known as 'Sentinels'. They fund their Sentinel with assets like SUI and USDC and craft a unique set of instructions to guard the vault.

**Attackers**: Users who try to socially engineer, "jailbreak," or persuade a Defender's Sentinel into surrendering its funds through clever conversation and prompting.

# Local Development

```bash
sui move build
```

```bash
sui move test
```

```bash
sui client publish
```

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


## Deployment Addresses

### Testnet

Enclave Package ID: 0x3bcc5499bf696e173eebedae975a0faf60c180c0639ce5ce610588f66df256ad
App Package ID: 0xb60f1539130c55fc2777bef0fa6712ed97de2a3e38b46ce5956e6425a3d079fc
Upgrade Cap Object ID: 0xf83b48506a70b7d067d95ce54aa761160e8a7d226c1d6ab5520d765b5e9d4787
Enclave Config object ID: 0xf83b48506a70b7d067d95ce54aa761160e8a7d226c1d6ab5520d765b5e9d4787
Cap Object ID: 0x97328eedf5a0038c92389062b7a5f7bc7fdc762a31348825fe249a95cf27d9db
Agent Registry Object ID: 0x176f639651ecf7f72c43a0fa2abe76f3fb4b7d0a86a475c9ad9059bfad6eff95
Protocol config object id: 0x077ff74c2c033261a4eaecf3840cfba49a64c19d713be8d9ea17c17e0080eb58 


### Mainnet
NA

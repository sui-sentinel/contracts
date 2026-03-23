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

0xb0a3b08be99cb5becf1787e565cdd027edc40791df89ca4a603ba7d1575b21e9::sentinel::SENTINEL

### Mainnet

NA

```
sui client transfer \
  --object-id <YOUR_CUSTOM_COIN_OBJECT_ID> \
  --to <RECIPIENT_ADDRESS> \
  --gas-budget 20000000
  ``


```

sui client transfer --to 0xc647dfdb8d8b575809902c9b86a26b6ace9f9271dfe5385468f503833a237177 --object-id 0xc30d67a66387a31f2e0b671c90a6db10c047438cf3017ed1b90c10baf1022b8d

```

```

Check Active Address

```bash
sui client active-address
```

Switch Env to mainnet

```bash
sui client switch --env mainnet
```

Check Active Env

```bash
sui client active-env
```

```bash
sui client objects --filter 0x4db142b98001936f97adcf1f15a625fef0a2f3b1a59ef36b23ecf26e938a33ac::enclave::Cap
```

sui client objects --json | jq -r '.[] | select(.objectType == "0x4db142b98001936f97adcf1f15a625fef0a2f3b1a59ef36b23ecf26e938a33ac::enclave::Cap")'

sui client query "0x4db142b98001936f97adcf1f15a625fef0a2f3b1a59ef36b23ecf26e938a33ac::enclave::EnclaveConfig" --limit 10

EnclaveConfig = 0x7c7bde1f1026d9ae7672593a1c860e629e98a2855fa0fabc429faba382c37277
ProtocolRegistry = 0x29e941ef8ab71e09d23336f34c7535983586e071eee107f927e3dcffa8cb8fbe
ProtocolConfig = 0x168ce294a3b3ca3456f505ae0fd58fe0bbe660725b7fce41c3263f3aade0094d

First is register the new enclave


# Tokens addresses on Sui Mainnet
"0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
"0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
"0x9f854b3ad20f8161ec0886f15f4a1752bf75d22261556f14cc8d3a1c5d50e529::magma::MAGMA",
"0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI",
"0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
"0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
"0x876a4b7bce8aeaef60464c11f4026903e9afacab79b9b142686158aa86560b50::xbtc::XBTC",
"0x66aaa74fecd25cb19b7576e101b25fd3a844e6b9f678421429d0d49d55e0fca0::sentinel::SENTINEL",
"0xe1b45a0e641b9955a20aa0ad1c1f4ad86aad8afb07296d4085e349a50e90bdca::blue::BLUE",
"0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
"0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK",
"0xd1b72982e40348d069bb1ff701e634c117bb5f741f44dff91e472d3b01461e55::stsui::STSUI",
"0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH

# Steps To Publish contracts

1. Run `scripts/publish.ts` and select testnet, enclave and deploy enclave contract
2. You will get enclave package ID in response, set it in `testnet.config.json`
3. Update `enclave/Move.toml` and and add `published-at` with new enclave package ID and also update `[enclave]addresses` to package ID
4. Now deploy app contract using `scripts/publish.ts` and select testnet -> app
5. Update `APP_PACKAGE_ID`, `AGENT_REGISTRY`, `PROTOCOL_CONFIG_ID`, `ENCLAVE_CONFIG_OBJECT_ID`, `CAP_OBJECT_ID` from new log file generated in `logs` folder
6. Update PCRs on-chain using `bun run scripts/script.ts update-pcrs  --network testnet`
7. Register Enclave using `bun run scripts/script.ts register-enclave --network testnet`
8. You will get `ENCLAVE_OBJECT_ID` in response. set it in `testnet.config.json`
9. Call `set_canonical_enclave` method of app contract using `bun run scripts/script.ts set-canonical-enclave --network testnet`
10. set new tokens to whitelist in `TOKENS_TO_WHITELIST` and Call `bun run scripts/script.ts add-whitelisted-tokens --network testnet` to whitelist new tokens

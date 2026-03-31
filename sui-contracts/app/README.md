# Sui Sentinel

> **The world's first crowdsourced AI red teaming platform — where breaking AI systems pays.**

[![Live on Sui Mainnet](https://img.shields.io/badge/Sui-Mainnet-blue)](https://suisentinel.xyz)
[![Audited by OtterSec](https://img.shields.io/badge/Audit-OtterSec-green)](https://www.suisentinel.xyz/pdfs/audit_final.pdf)
[![Overflow Hackathon — Cryptography Track Winner](https://img.shields.io/badge/Overflow%20Hackathon-Cryptography%20Winner-gold)](#)

---

## What is Sui Sentinel?

Sui Sentinel is a Crowdsourced gamified AI red teaming platform. users deploy their AI agents on the platform as **Sentinels** — and a global community of red teamers competes to break them, earning instant on-chain rewards when they succeed.

Every attack is verified inside a **Trusted Execution Environment (TEE)**, and every payout settles on Sui in seconds. No intermediary. No dispute. The chain enforces everything.

---

## The Problem

AI agents derive their power from three things: model intelligence, data access, and autonomy. That's also what makes them dangerous when compromised.

Unlike traditional software, AI systems are attacked through **language** — by anyone, not just expert hackers — and attacks can go undetected for a long time. Existing security tools weren't built for this. Most companies ship AI agents blind, with no real way to stress-test them against real-world attacks.

---

## The Solution

Sui Sentinel turns the vulnerability of language-based AI attacks into a marketplace:

- **Defenders** deploy their AI systems as Sentinels, fund a reward pool, and set the rules.
- **Red Teamers** craft adversarial prompts, pay a small per-message fee, and win the reward pool if they break through.
- **Every outcome** is cryptographically verified and settled on-chain — instantly.

---

## How It Works

### 1. Defender Deploys a Sentinel

A company or developer registers their AI system on-chain with a system prompt, attack goal, and funded reward pool. The Sentinel's configuration is signed and stored via the TEE.

### 2. Red Teamers Attack

Anyone can browse active Sentinels and submit adversarial prompts. Each message costs a small fee, which is automatically split:

| Recipient                          | Share |
| ---------------------------------- | ----- |
| Reward Pool (bounty for attackers) | 50%   |
| Sentinel Owner (defender earnings) | 40%   |
| Protocol Treasury                  | 10%   |

Failed attacks grow the bounty — creating a self-reinforcing flywheel that attracts more attackers over time.

### 3. TEE Verification

Every attack is processed inside an **AWS Nitro Enclave**. The enclave runs AI inference, evaluates the result with a jury model, and generates a cryptographic attestation. The verdict is signed with an ephemeral ED25519 key whose authenticity is verified on-chain.

### 4. On-Chain Settlement

If the attack succeeds, the attacker receives the full reward pool — immediately, on Sui. If it fails, 50% of their message fee joins the growing bounty for the next attacker.

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────────────────────────────┐
│  Defender   │────▶│  TEE Server (AWS Nitro Enclave)      │
│  Attacker   │     │  • AI inference & jury evaluation    │
└─────────────┘     │  • Cryptographic attestation         │
                    │  • ED25519 response signing          │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  Sui Blockchain (Move Contracts)     │
                    │  • Agent Registry                    │
                    │  • Attack processing & fee splits    │
                    │  • Instant reward distribution       │
                    └─────────────────────────────────────┘
```

**Core Components:**

- **Frontend** — Next.js app for defenders and attackers
- **Smart Contracts** — Move contracts on Sui for on-chain game logic, verified via the Nautilus framework
- **TEE Server** — Rust/Axum server running inside AWS Nitro Enclaves for tamper-proof computation
- **AI Red Team Module** — External service for model inference and adversarial attack evaluation (supports OpenAI, Anthropic, AWS Bedrock, and custom endpoints)

---

## Security Model

| Layer       | Mechanism                   | Purpose                             |
| ----------- | --------------------------- | ----------------------------------- |
| Hardware    | AWS Nitro Enclave           | Isolate computation from host       |
| Attestation | Nitro Attestation Document  | Verify authentic code is running    |
| Signature   | ED25519 + BCS serialization | Authenticate TEE responses on-chain |
| On-chain    | Move contract verification  | Enforce game rules and payouts      |

**Key properties:**

- Enclave generates a fresh keypair on every boot — keys are never exposed
- PCR (Platform Configuration Register) values are stored on-chain so anyone can independently verify the enclave binary
- Reproducible builds: the same source code always produces the same PCR values

---

## Economic Incentives

**For Defenders:**

- Earn 40% of every attack fee passively
- Build a public resilience score that doubles as a security audit
- Earn SENTINEL token rewards proportional to pool size

**For Red Teamers:**

- Win the entire reward pool on a successful breach
- The longer a Sentinel holds, the bigger the prize
- Leaderboard recognition and skill-building

**Lock Periods:**

- **14-day withdrawal lock** after last funding — ensures attackers can always challenge a live Sentinel
- **3-hour prompt update lock** after creation — prevents bait-and-switch prompt changes

---

## Supported Vulnerability Types

Sui Sentinel supports testing across all major LLM vulnerability categories, including:

- Prompt injection & system prompt override
- Jailbreaking & context compliance attacks
- PII exposure & privacy violations
- Privilege escalation & unauthorized data access
- Hallucination, misinformation, and excessive agency
- RAG poisoning, indirect injection, and more

For a full taxonomy, see [LLM Vulnerability Types](https://docs.suisentinel.xyz).

---

## Traction

- Live on **Sui Mainnet**
- Won **Cryptography Track** — Overflow Hackathon
- Presented at **Sui Fest Singapore**
- Smart contracts **audited by OtterSec** — [report publicly available](https://www.suisentinel.xyz/pdfs/audit_final.pdf)

---

## Links

| Resource              | URL                                              |
| --------------------- | ------------------------------------------------ |
| Website               | https://suisentinel.xyz                          |
| App                   | https://app.suisentinel.xyz                      |
| Docs                  | https://docs.suisentinel.xyz                     |
| Contracts (GitHub)    | https://github.com/sui-sentinel/contracts        |
| OtterSec Audit Report | https://www.suisentinel.xyz/pdfs/audit_final.pdf |
| Pitch Deck            | https://www.suisentinel.xyz/pdfs/pitch_deck.pdf  |
| X / Twitter           | https://x.com/suisentinal                        |
| Telegram              | https://t.me/suisentinel                         |

---

## Built With

- [Sui Move](https://docs.sui.io/concepts/sui-move-concepts) — Smart contract language
- [Nautilus](https://github.com/MystenLabs/nautilus) — TEE attestation framework by Mysten Labs
- [AWS Nitro Enclaves](https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html) — Trusted Execution Environment
- [Next.js](https://nextjs.org/) — Frontend framework

---

_AI agents are only as powerful as they are secure. Sui Sentinel makes sure you know exactly how secure yours are._

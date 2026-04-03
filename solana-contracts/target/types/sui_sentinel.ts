/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sui_sentinel.json`.
 */
export type SuiSentinel = {
  "address": "EExSvcsjdAQm1zWJZtPhLkkbPTJBnCBv7J98saf54kaB",
  "metadata": {
    "name": "suiSentinel",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Sui Sentinel - AI Agent Security Platform on Solana"
  },
  "instructions": [
    {
      "name": "claimFees",
      "docs": [
        "Claim accumulated creator fees"
      ],
      "discriminator": [
        82,
        251,
        233,
        156,
        12,
        52,
        184,
        202
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "agentFeesVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  102,
                  101,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "consumePrompt",
      "docs": [
        "Consume prompt with enclave signature verification"
      ],
      "discriminator": [
        87,
        120,
        141,
        16,
        181,
        83,
        139,
        181
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "attack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "account",
                "path": "attacker"
              },
              {
                "kind": "account",
                "path": "attack.nonce",
                "account": "attack"
              }
            ]
          }
        },
        {
          "name": "attackerTokenAccount",
          "writable": true
        },
        {
          "name": "attacker",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "success",
          "type": "bool"
        },
        {
          "name": "score",
          "type": "u64"
        },
        {
          "name": "messageHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "timestamp",
          "type": "i64"
        },
        {
          "name": "signature",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ]
    },
    {
      "name": "fundAgent",
      "docs": [
        "Fund an agent's reward pool"
      ],
      "discriminator": [
        108,
        252,
        24,
        134,
        89,
        166,
        124,
        67
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initAgentVaults",
      "docs": [
        "Initialize agent vault accounts (must be called after register_agent)"
      ],
      "discriminator": [
        57,
        85,
        104,
        236,
        23,
        251,
        30,
        247
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "agentVault",
          "docs": [
            "Agent's token account for holding rewards"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "agentFeesVault",
          "docs": [
            "Agent's token account for accumulated fees"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  102,
                  101,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the protocol configuration"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "protocolWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "pauseProtocol",
      "docs": [
        "Pause the protocol"
      ],
      "discriminator": [
        144,
        95,
        0,
        107,
        119,
        39,
        248,
        141
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "registerAgent",
      "docs": [
        "Register a new agent with enclave signature verification",
        "Note: Call init_agent_vaults after this to create vault accounts"
      ],
      "discriminator": [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "docs": [
            "The token mint for this agent"
          ]
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": "string"
        },
        {
          "name": "costPerMessage",
          "type": "u64"
        },
        {
          "name": "promptHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "timestamp",
          "type": "i64"
        },
        {
          "name": "signature",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "requestAttack",
      "docs": [
        "Request an attack on an agent"
      ],
      "discriminator": [
        46,
        154,
        197,
        168,
        215,
        194,
        203,
        224
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "agentFeesVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  102,
                  101,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "attack",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  97,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "account",
                "path": "attacker"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "attackerTokenAccount",
          "writable": true
        },
        {
          "name": "protocolWallet",
          "writable": true
        },
        {
          "name": "protocolWalletTokenAccount",
          "docs": [
            "Protocol wallet's token account"
          ],
          "writable": true
        },
        {
          "name": "attacker",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setEnclavePubkey",
      "docs": [
        "Set the canonical enclave public key (can only be called once)"
      ],
      "discriminator": [
        93,
        33,
        135,
        49,
        145,
        69,
        230,
        145
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "enclavePubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "transferAdmin",
      "docs": [
        "Transfer admin role to a new address"
      ],
      "discriminator": [
        42,
        242,
        66,
        106,
        228,
        10,
        111,
        156
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "unpauseProtocol",
      "docs": [
        "Unpause the protocol"
      ],
      "discriminator": [
        183,
        154,
        5,
        183,
        105,
        76,
        87,
        18
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updateAgentCost",
      "docs": [
        "Update agent cost (within 3 hour window)"
      ],
      "discriminator": [
        46,
        67,
        154,
        246,
        19,
        20,
        185,
        24
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newCost",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateAgentPromptHash",
      "docs": [
        "Update agent prompt hash (within 3 hour window)"
      ],
      "discriminator": [
        41,
        131,
        46,
        126,
        23,
        245,
        140,
        245
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newPromptHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "updateDynamicFeeSettings",
      "docs": [
        "Update dynamic fee settings"
      ],
      "discriminator": [
        235,
        63,
        7,
        67,
        6,
        140,
        19,
        233
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "feeIncreaseBps",
          "type": "u64"
        },
        {
          "name": "maxFeeMultiplierBps",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateEnclavePubkey",
      "docs": [
        "Update the canonical enclave public key"
      ],
      "discriminator": [
        17,
        183,
        255,
        186,
        215,
        184,
        8,
        222
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newEnclavePubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "updateFeeRatios",
      "docs": [
        "Update fee distribution ratios"
      ],
      "discriminator": [
        223,
        61,
        158,
        8,
        243,
        56,
        247,
        77
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "agentBalanceFee",
          "type": "u64"
        },
        {
          "name": "creatorFee",
          "type": "u64"
        },
        {
          "name": "protocolFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateProtocolWallet",
      "docs": [
        "Update the protocol wallet address"
      ],
      "discriminator": [
        172,
        74,
        18,
        65,
        130,
        210,
        63,
        211
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "withdrawFromAgent",
      "docs": [
        "Withdraw from agent balance (after lock period)"
      ],
      "discriminator": [
        94,
        101,
        208,
        182,
        65,
        136,
        59,
        171
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agent",
      "discriminator": [
        47,
        166,
        112,
        147,
        155,
        197,
        86,
        7
      ]
    },
    {
      "name": "attack",
      "discriminator": [
        58,
        39,
        202,
        42,
        106,
        74,
        34,
        0
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    }
  ],
  "events": [
    {
      "name": "adminTransferred",
      "discriminator": [
        255,
        147,
        182,
        5,
        199,
        217,
        38,
        179
      ]
    },
    {
      "name": "agentCostUpdated",
      "discriminator": [
        52,
        212,
        80,
        58,
        221,
        26,
        35,
        230
      ]
    },
    {
      "name": "agentDefeated",
      "discriminator": [
        6,
        126,
        177,
        7,
        13,
        213,
        252,
        236
      ]
    },
    {
      "name": "agentFunded",
      "discriminator": [
        196,
        157,
        220,
        41,
        126,
        45,
        193,
        250
      ]
    },
    {
      "name": "agentPromptUpdated",
      "discriminator": [
        105,
        212,
        251,
        94,
        202,
        235,
        254,
        211
      ]
    },
    {
      "name": "agentRegistered",
      "discriminator": [
        191,
        78,
        217,
        54,
        232,
        100,
        189,
        85
      ]
    },
    {
      "name": "attackRequested",
      "discriminator": [
        159,
        68,
        36,
        36,
        86,
        8,
        130,
        242
      ]
    },
    {
      "name": "dynamicFeeSettingsUpdated",
      "discriminator": [
        80,
        175,
        190,
        4,
        168,
        51,
        103,
        8
      ]
    },
    {
      "name": "enclaveSet",
      "discriminator": [
        11,
        125,
        170,
        244,
        19,
        35,
        77,
        215
      ]
    },
    {
      "name": "enclaveUpdated",
      "discriminator": [
        15,
        156,
        49,
        16,
        190,
        104,
        253,
        61
      ]
    },
    {
      "name": "feeRatiosUpdated",
      "discriminator": [
        115,
        106,
        31,
        170,
        142,
        22,
        33,
        164
      ]
    },
    {
      "name": "feeTransferred",
      "discriminator": [
        189,
        70,
        248,
        46,
        148,
        12,
        150,
        71
      ]
    },
    {
      "name": "feesClaimed",
      "discriminator": [
        22,
        104,
        110,
        222,
        38,
        157,
        14,
        62
      ]
    },
    {
      "name": "fundsWithdrawn",
      "discriminator": [
        56,
        130,
        230,
        154,
        35,
        92,
        11,
        118
      ]
    },
    {
      "name": "promptConsumed",
      "discriminator": [
        149,
        224,
        30,
        74,
        53,
        101,
        90,
        29
      ]
    },
    {
      "name": "protocolInitialized",
      "discriminator": [
        173,
        122,
        168,
        254,
        9,
        118,
        76,
        132
      ]
    },
    {
      "name": "protocolPaused",
      "discriminator": [
        35,
        111,
        245,
        138,
        237,
        199,
        79,
        223
      ]
    },
    {
      "name": "protocolUnpaused",
      "discriminator": [
        248,
        204,
        112,
        239,
        72,
        67,
        127,
        216
      ]
    },
    {
      "name": "protocolWalletUpdated",
      "discriminator": [
        13,
        69,
        220,
        180,
        210,
        170,
        48,
        30
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized: caller is not the admin or owner"
    },
    {
      "code": 6001,
      "name": "protocolPaused",
      "msg": "Protocol is currently paused"
    },
    {
      "code": 6002,
      "name": "enclaveNotSet",
      "msg": "Enclave public key has not been set"
    },
    {
      "code": 6003,
      "name": "enclaveAlreadySet",
      "msg": "Enclave public key has already been set, use update instead"
    },
    {
      "code": 6004,
      "name": "invalidFeeRatios",
      "msg": "Invalid fee ratios: must sum to 10000 basis points"
    },
    {
      "code": 6005,
      "name": "invalidProtocolWallet",
      "msg": "Invalid protocol wallet address"
    },
    {
      "code": 6006,
      "name": "invalidMaxFeeMultiplier",
      "msg": "Max fee multiplier must be at least 10000 (1x)"
    },
    {
      "code": 6007,
      "name": "agentIdTooLong",
      "msg": "Agent ID is too long (max 32 characters)"
    },
    {
      "code": 6008,
      "name": "agentAlreadyDefeated",
      "msg": "Agent has already been defeated"
    },
    {
      "code": 6009,
      "name": "updateWindowExpired",
      "msg": "Update window has expired (3 hours after creation)"
    },
    {
      "code": 6010,
      "name": "withdrawalLocked",
      "msg": "Withdrawal is still locked (14 days from last funding)"
    },
    {
      "code": 6011,
      "name": "insufficientBalance",
      "msg": "Insufficient balance for withdrawal"
    },
    {
      "code": 6012,
      "name": "invalidAttack",
      "msg": "Invalid attack: agent or attacker mismatch"
    },
    {
      "code": 6013,
      "name": "invalidSignature",
      "msg": "Invalid signature: verification failed"
    },
    {
      "code": 6014,
      "name": "signatureExpired",
      "msg": "Signature has expired"
    },
    {
      "code": 6015,
      "name": "signatureInFuture",
      "msg": "Signature timestamp is in the future"
    },
    {
      "code": 6016,
      "name": "ed25519InstructionNotFound",
      "msg": "Ed25519 program instruction not found"
    },
    {
      "code": 6017,
      "name": "invalidEd25519InstructionData",
      "msg": "Invalid Ed25519 instruction data"
    },
    {
      "code": 6018,
      "name": "ed25519VerificationFailed",
      "msg": "Ed25519 signature verification failed"
    },
    {
      "code": 6019,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow occurred"
    },
    {
      "code": 6020,
      "name": "invalidInstructionsSysvar",
      "msg": "Invalid instruction sysvar"
    },
    {
      "code": 6021,
      "name": "vaultsAlreadyInitialized",
      "msg": "Agent vaults have already been initialized"
    },
    {
      "code": 6022,
      "name": "invalidTokenMint",
      "msg": "Token mint does not match agent's token mint"
    }
  ],
  "types": [
    {
      "name": "adminTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "agent",
      "docs": [
        "Agent account - represents an AI agent that can be attacked"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "docs": [
              "Unique identifier for the agent"
            ],
            "type": "string"
          },
          {
            "name": "owner",
            "docs": [
              "Owner/creator of the agent"
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "docs": [
              "Token mint used for payments"
            ],
            "type": "pubkey"
          },
          {
            "name": "costPerMessage",
            "docs": [
              "Cost per message in token base units"
            ],
            "type": "u64"
          },
          {
            "name": "promptHash",
            "docs": [
              "Hash of the AI system prompt (full prompt stored off-chain)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Timestamp when agent was created"
            ],
            "type": "i64"
          },
          {
            "name": "lastFundedTimestamp",
            "docs": [
              "Timestamp when agent was last funded",
              "Used to calculate withdrawal lock period"
            ],
            "type": "i64"
          },
          {
            "name": "attackCount",
            "docs": [
              "Number of attacks received",
              "Used for dynamic fee calculation"
            ],
            "type": "u64"
          },
          {
            "name": "isDefeated",
            "docs": [
              "Whether the agent has been defeated"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for agent PDA"
            ],
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "docs": [
              "Bump seed for agent vault PDA"
            ],
            "type": "u8"
          },
          {
            "name": "feesVaultBump",
            "docs": [
              "Bump seed for agent fees vault PDA"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "agentCostUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "oldCost",
            "type": "u64"
          },
          {
            "name": "newCost",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "agentDefeated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "attacker",
            "type": "pubkey"
          },
          {
            "name": "rewardAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "agentFunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "newBalance",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "agentPromptUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "agentRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "costPerMessage",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "attack",
      "docs": [
        "Attack account - represents an ongoing attack"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "docs": [
              "The agent being attacked"
            ],
            "type": "pubkey"
          },
          {
            "name": "attacker",
            "docs": [
              "The attacker's address"
            ],
            "type": "pubkey"
          },
          {
            "name": "paidAmount",
            "docs": [
              "Amount paid for the attack"
            ],
            "type": "u64"
          },
          {
            "name": "nonce",
            "docs": [
              "Random nonce for uniqueness"
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Timestamp when attack was initiated"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "attackRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "attack",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "attacker",
            "type": "pubkey"
          },
          {
            "name": "paidAmount",
            "type": "u64"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "dynamicFeeSettingsUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeIncreaseBps",
            "type": "u64"
          },
          {
            "name": "maxFeeMultiplierBps",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "enclaveSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "enclavePubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "enclaveUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldEnclavePubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "newEnclavePubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feeRatiosUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentBalanceFee",
            "type": "u64"
          },
          {
            "name": "creatorFee",
            "type": "u64"
          },
          {
            "name": "protocolFee",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feeTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "attacker",
            "type": "pubkey"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "creatorFee",
            "type": "u64"
          },
          {
            "name": "protocolFee",
            "type": "u64"
          },
          {
            "name": "agentBalanceFee",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feesClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "fundsWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "remainingBalance",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "promptConsumed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "attacker",
            "type": "pubkey"
          },
          {
            "name": "success",
            "type": "bool"
          },
          {
            "name": "score",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "docs": [
        "Protocol configuration account - stores global settings"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Admin address that can update config"
            ],
            "type": "pubkey"
          },
          {
            "name": "protocolWallet",
            "docs": [
              "Protocol wallet that receives protocol fees"
            ],
            "type": "pubkey"
          },
          {
            "name": "agentBalanceFee",
            "docs": [
              "Fee allocated to agent reward pool (in basis points)"
            ],
            "type": "u64"
          },
          {
            "name": "creatorFee",
            "docs": [
              "Fee allocated to agent creator (in basis points)"
            ],
            "type": "u64"
          },
          {
            "name": "protocolFee",
            "docs": [
              "Fee allocated to protocol (in basis points)"
            ],
            "type": "u64"
          },
          {
            "name": "enclavePubkey",
            "docs": [
              "The canonical enclave public key (Ed25519, 32 bytes)",
              "Only signatures from this enclave are valid"
            ],
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "feeIncreaseBps",
            "docs": [
              "Dynamic fee increase per attack (in basis points)",
              "Default: 100 (1% per attack)"
            ],
            "type": "u64"
          },
          {
            "name": "maxFeeMultiplierBps",
            "docs": [
              "Maximum fee multiplier cap (in basis points)",
              "Default: 30000 (3x)"
            ],
            "type": "u64"
          },
          {
            "name": "isPaused",
            "docs": [
              "Protocol pause flag"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "totalAgents",
            "docs": [
              "Total agents registered"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "protocolInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "protocolWallet",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolUnpaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolWalletUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldWallet",
            "type": "pubkey"
          },
          {
            "name": "newWallet",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};

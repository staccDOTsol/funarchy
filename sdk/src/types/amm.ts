/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/amm.json`.
 */
export type Amm = {
  address: "62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH";
  metadata: {
    name: "amm";
    version: "0.3.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "createAmm";
      discriminator: [242, 91, 21, 170, 5, 68, 125, 64];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "amm";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 109, 109, 95, 95];
              },
              {
                kind: "account";
                path: "baseMint";
              },
              {
                kind: "account";
                path: "quoteMint";
              }
            ];
          };
        },
        {
          name: "baseMint";
          writable: true;
        },
        {
          name: "quoteMint";
        },
        {
          name: "vaultAtaBase";
          writable: true;
        },
        {
          name: "vaultAtaQuote";
          writable: true;
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "baseTokenMetadata";
          writable: true;
        },
        {
          name: "metadataProgram";
          address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "pof";
          type: "string";
        },
        {
          name: "uri";
          type: "string";
        },
        {
          name: "proposalNumber";
          type: "u16";
        },
        {
          name: "symbol";
          type: "string";
        },
        {
          name: "a";
          type: "u8";
        }
      ];
    },
    {
      name: "swap";
      discriminator: [248, 198, 158, 145, 225, 117, 135, 200];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "amm";
          writable: true;
        },
        {
          name: "userBaseAccount";
          writable: true;
        },
        {
          name: "userQuoteAccount";
          writable: true;
        },
        {
          name: "vaultAtaBase";
          writable: true;
        },
        {
          name: "vaultAtaQuote";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "token2022Program";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        },
        {
          name: "baseMint";
          writable: true;
        },
        {
          name: "quoteMint";
          writable: true;
        },
        {
          name: "raydiumCpSwapProgram";
          address: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
        },
        {
          name: "ammConfig";
        },
        {
          name: "authority";
        },
        {
          name: "poolAccount";
          writable: true;
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "token0Vault";
          writable: true;
        },
        {
          name: "token1Vault";
          writable: true;
        },
        {
          name: "createLpAccount";
          writable: true;
        },
        {
          name: "createPoolFee";
          writable: true;
        },
        {
          name: "observationKey";
          writable: true;
        },
        {
          name: "lpMint";
          writable: true;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "amm";
      discriminator: [143, 245, 200, 17, 74, 214, 196, 135];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "noSlotsPassed";
      msg: "Can't get a TWAP before some observations have been stored";
    },
    {
      code: 6001;
      name: "noReserves";
      msg: "Can't swap through a pool without token reserves on either side";
    },
    {
      code: 6002;
      name: "inputAmountOverflow";
      msg: "Input token amount is too large for a swap, causes overflow";
    },
    {
      code: 6003;
      name: "addLiquidityCalculationError";
      msg: "Add liquidity calculation error";
    },
    {
      code: 6004;
      name: "decimalScaleError";
      msg: "Error in decimal scale conversion";
    },
    {
      code: 6005;
      name: "sameTokenMints";
      msg: "You can't create an AMM pool where the token mints are the same";
    },
    {
      code: 6006;
      name: "swapSlippageExceeded";
      msg: "A user wouldn't have gotten back their `output_amount_min`, reverting";
    },
    {
      code: 6007;
      name: "insufficientBalance";
      msg: "The user had insufficient balance to do this";
    },
    {
      code: 6008;
      name: "zeroLiquidityRemove";
      msg: "Must remove a non-zero amount of liquidity";
    },
    {
      code: 6009;
      name: "zeroLiquidityToAdd";
      msg: "Cannot add liquidity with 0 tokens on either side";
    },
    {
      code: 6010;
      name: "zeroMinLpTokens";
      msg: "Must specify a non-zero `min_lp_tokens` when adding to an existing pool";
    },
    {
      code: 6011;
      name: "addLiquiditySlippageExceeded";
      msg: "LP wouldn't have gotten back `lp_token_min`";
    },
    {
      code: 6012;
      name: "addLiquidityMaxBaseExceeded";
      msg: "LP would have spent more than `max_base_amount`";
    },
    {
      code: 6013;
      name: "insufficientQuoteAmount";
      msg: "`quote_amount` must be greater than 100000000 when initializing a pool";
    },
    {
      code: 6014;
      name: "zeroSwapAmount";
      msg: "Users must swap a non-zero amount";
    },
    {
      code: 6015;
      name: "constantProductInvariantFailed";
      msg: "K should always be increasing";
    },
    {
      code: 6016;
      name: "castingOverflow";
      msg: "Casting has caused an overflow";
    },
    {
      code: 6017;
      name: "invalidSupply";
      msg: "The pool has an invalid supply";
    },
    {
      code: 6018;
      name: "invalidMintAuthority";
      msg: "The pool has an invalid mint authority";
    },
    {
      code: 6019;
      name: "buyDisabled";
      msg: "The pool disabled buying";
    },
    {
      code: 6020;
      name: "sellDisabled";
      msg: "The pool disabled selling";
    }
  ];
  types: [
    {
      name: "amm";
      serialization: "bytemuckunsafe";
      repr: {
        kind: "rust";
        packed: true;
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "createdAtSlot";
            type: "u64";
          },
          {
            name: "baseMint";
            type: "pubkey";
          },
          {
            name: "quoteMint";
            type: "pubkey";
          },
          {
            name: "baseMintDecimals";
            type: "u8";
          },
          {
            name: "quoteMintDecimals";
            type: "u8";
          },
          {
            name: "baseAmount";
            type: "u64";
          },
          {
            name: "quoteAmount";
            type: "u64";
          },
          {
            name: "vQuoteReserves";
            type: "u64";
          },
          {
            name: "vBaseReserves";
            type: "u64";
          },
          {
            name: "quoteReserves";
            type: "u64";
          },
          {
            name: "baseReserves";
            type: "u64";
          },
          {
            name: "vaultStatus";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "swapArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "swapType";
            type: {
              defined: {
                name: "swapType";
              };
            };
          },
          {
            name: "inputAmount";
            type: "u64";
          },
          {
            name: "outputAmountMin";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "swapType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "buy";
          },
          {
            name: "sell";
          }
        ];
      };
    }
  ];
};

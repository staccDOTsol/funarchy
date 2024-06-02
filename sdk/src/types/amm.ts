export type Amm = {
  version: "0.3.0";
  name: "amm";
  instructions: [
    {
      name: "createAmm";
      accounts: [
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "amm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultAtaBase";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaQuote";
          isMut: true;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "baseTokenMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "metadataProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
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
          name: "bump";
          type: "u8";
        }
      ];
    },
    {
      name: "swap";
      accounts: [
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "amm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userBaseAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userQuoteAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaBase";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaQuote";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "token2022Program";
          isMut: false;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "quoteMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "raydiumCpSwapProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "ammConfig";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "poolAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        },
        {
          name: "token0Vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "token1Vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "createLpAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "createPoolFee";
          isMut: true;
          isSigner: false;
        },
        {
          name: "observationKey";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lpMint";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "SwapArgs";
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "amm";
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
            type: "publicKey";
          },
          {
            name: "quoteMint";
            type: "publicKey";
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
    }
  ];
  types: [
    {
      name: "SwapArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "swapType";
            type: {
              defined: "SwapType";
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
      name: "SwapType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Buy";
          },
          {
            name: "Sell";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "NoSlotsPassed";
      msg: "Can't get a TWAP before some observations have been stored";
    },
    {
      code: 6001;
      name: "NoReserves";
      msg: "Can't swap through a pool without token reserves on either side";
    },
    {
      code: 6002;
      name: "InputAmountOverflow";
      msg: "Input token amount is too large for a swap, causes overflow";
    },
    {
      code: 6003;
      name: "AddLiquidityCalculationError";
      msg: "Add liquidity calculation error";
    },
    {
      code: 6004;
      name: "DecimalScaleError";
      msg: "Error in decimal scale conversion";
    },
    {
      code: 6005;
      name: "SameTokenMints";
      msg: "You can't create an AMM pool where the token mints are the same";
    },
    {
      code: 6006;
      name: "SwapSlippageExceeded";
      msg: "A user wouldn't have gotten back their `output_amount_min`, reverting";
    },
    {
      code: 6007;
      name: "InsufficientBalance";
      msg: "The user had insufficient balance to do this";
    },
    {
      code: 6008;
      name: "ZeroLiquidityRemove";
      msg: "Must remove a non-zero amount of liquidity";
    },
    {
      code: 6009;
      name: "ZeroLiquidityToAdd";
      msg: "Cannot add liquidity with 0 tokens on either side";
    },
    {
      code: 6010;
      name: "ZeroMinLpTokens";
      msg: "Must specify a non-zero `min_lp_tokens` when adding to an existing pool";
    },
    {
      code: 6011;
      name: "AddLiquiditySlippageExceeded";
      msg: "LP wouldn't have gotten back `lp_token_min`";
    },
    {
      code: 6012;
      name: "AddLiquidityMaxBaseExceeded";
      msg: "LP would have spent more than `max_base_amount`";
    },
    {
      code: 6013;
      name: "InsufficientQuoteAmount";
      msg: "`quote_amount` must be greater than 100000000 when initializing a pool";
    },
    {
      code: 6014;
      name: "ZeroSwapAmount";
      msg: "Users must swap a non-zero amount";
    },
    {
      code: 6015;
      name: "ConstantProductInvariantFailed";
      msg: "K should always be increasing";
    },
    {
      code: 6016;
      name: "CastingOverflow";
      msg: "Casting has caused an overflow";
    },
    {
      code: 6017;
      name: "InvalidSupply";
      msg: "The pool has an invalid supply";
    },
    {
      code: 6018;
      name: "InvalidMintAuthority";
      msg: "The pool has an invalid mint authority";
    },
    {
      code: 6019;
      name: "BuyDisabled";
      msg: "The pool disabled buying";
    },
    {
      code: 6020;
      name: "SellDisabled";
      msg: "The pool disabled selling";
    }
  ];
};

export const IDL: Amm = {
  version: "0.3.0",
  name: "amm",
  instructions: [
    {
      name: "createAmm",
      accounts: [
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "amm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultAtaBase",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaQuote",
          isMut: true,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "baseTokenMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "metadataProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "pof",
          type: "string",
        },
        {
          name: "uri",
          type: "string",
        },
        {
          name: "proposalNumber",
          type: "u16",
        },
        {
          name: "symbol",
          type: "string",
        },
        {
          name: "bump",
          type: "u8",
        },
      ],
    },
    {
      name: "swap",
      accounts: [
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "amm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userBaseAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userQuoteAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaBase",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaQuote",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "token2022Program",
          isMut: false,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "quoteMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "raydiumCpSwapProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "ammConfig",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "poolAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
        {
          name: "token0Vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "token1Vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "createLpAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "createPoolFee",
          isMut: true,
          isSigner: false,
        },
        {
          name: "observationKey",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lpMint",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "SwapArgs",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "amm",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "createdAtSlot",
            type: "u64",
          },
          {
            name: "baseMint",
            type: "publicKey",
          },
          {
            name: "quoteMint",
            type: "publicKey",
          },
          {
            name: "baseMintDecimals",
            type: "u8",
          },
          {
            name: "quoteMintDecimals",
            type: "u8",
          },
          {
            name: "baseAmount",
            type: "u64",
          },
          {
            name: "quoteAmount",
            type: "u64",
          },
          {
            name: "vQuoteReserves",
            type: "u64",
          },
          {
            name: "vBaseReserves",
            type: "u64",
          },
          {
            name: "quoteReserves",
            type: "u64",
          },
          {
            name: "baseReserves",
            type: "u64",
          },
          {
            name: "vaultStatus",
            type: "u8",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "SwapArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "swapType",
            type: {
              defined: "SwapType",
            },
          },
          {
            name: "inputAmount",
            type: "u64",
          },
          {
            name: "outputAmountMin",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "SwapType",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Buy",
          },
          {
            name: "Sell",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "NoSlotsPassed",
      msg: "Can't get a TWAP before some observations have been stored",
    },
    {
      code: 6001,
      name: "NoReserves",
      msg: "Can't swap through a pool without token reserves on either side",
    },
    {
      code: 6002,
      name: "InputAmountOverflow",
      msg: "Input token amount is too large for a swap, causes overflow",
    },
    {
      code: 6003,
      name: "AddLiquidityCalculationError",
      msg: "Add liquidity calculation error",
    },
    {
      code: 6004,
      name: "DecimalScaleError",
      msg: "Error in decimal scale conversion",
    },
    {
      code: 6005,
      name: "SameTokenMints",
      msg: "You can't create an AMM pool where the token mints are the same",
    },
    {
      code: 6006,
      name: "SwapSlippageExceeded",
      msg: "A user wouldn't have gotten back their `output_amount_min`, reverting",
    },
    {
      code: 6007,
      name: "InsufficientBalance",
      msg: "The user had insufficient balance to do this",
    },
    {
      code: 6008,
      name: "ZeroLiquidityRemove",
      msg: "Must remove a non-zero amount of liquidity",
    },
    {
      code: 6009,
      name: "ZeroLiquidityToAdd",
      msg: "Cannot add liquidity with 0 tokens on either side",
    },
    {
      code: 6010,
      name: "ZeroMinLpTokens",
      msg: "Must specify a non-zero `min_lp_tokens` when adding to an existing pool",
    },
    {
      code: 6011,
      name: "AddLiquiditySlippageExceeded",
      msg: "LP wouldn't have gotten back `lp_token_min`",
    },
    {
      code: 6012,
      name: "AddLiquidityMaxBaseExceeded",
      msg: "LP would have spent more than `max_base_amount`",
    },
    {
      code: 6013,
      name: "InsufficientQuoteAmount",
      msg: "`quote_amount` must be greater than 100000000 when initializing a pool",
    },
    {
      code: 6014,
      name: "ZeroSwapAmount",
      msg: "Users must swap a non-zero amount",
    },
    {
      code: 6015,
      name: "ConstantProductInvariantFailed",
      msg: "K should always be increasing",
    },
    {
      code: 6016,
      name: "CastingOverflow",
      msg: "Casting has caused an overflow",
    },
    {
      code: 6017,
      name: "InvalidSupply",
      msg: "The pool has an invalid supply",
    },
    {
      code: 6018,
      name: "InvalidMintAuthority",
      msg: "The pool has an invalid mint authority",
    },
    {
      code: 6019,
      name: "BuyDisabled",
      msg: "The pool disabled buying",
    },
    {
      code: 6020,
      name: "SellDisabled",
      msg: "The pool disabled selling",
    },
  ],
};

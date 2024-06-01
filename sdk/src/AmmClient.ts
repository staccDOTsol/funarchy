import {
  AnchorProvider,
  Idl,
  IdlTypes,
  Program,
  utils,
} from "@coral-xyz/anchor";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  Signer,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { Amm, Amm as AmmIDLType } from "./types/amm";

import BN from "bn.js";
import { AMM_PROGRAM_ID } from "./constants";
import { AmmAccount, LowercaseKeys } from "./types/";
import { getAmmLpMintAddr, getAmmAddr } from "./utils/pda";
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import {
  MintLayout,
  unpackMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { PriceMath } from "./utils/priceMath";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

export async function createMint(
  connection: Connection,
  payer: Signer,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  keypair = Keypair.generate(),
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 138666,
    }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId,
    }),
    createInitializeMint2Instruction(
      keypair.publicKey,
      decimals,
      mintAuthority,
      freezeAuthority,
      programId
    )
  );

  await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, keypair],
    confirmOptions
  );

  return keypair.publicKey;
}
const idl = {
  address: "6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj",
  metadata: {
    name: "amm",
    version: "0.3.0",
    spec: "0.1.0",
    description: "Created with Anchor",
  },
  instructions: [
    {
      name: "create_amm",
      discriminator: [242, 91, 21, 170, 5, 68, 125, 64],
      accounts: [
        {
          name: "user",
          writable: true,
          signer: true,
        },
        {
          name: "amm",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [97, 109, 109, 95, 95],
              },
              {
                kind: "account",
                path: "base_mint",
              },
              {
                kind: "account",
                path: "quote_mint",
              },
            ],
          },
        },
        {
          name: "base_mint",
          writable: true,
        },
        {
          name: "quote_mint",
        },
        {
          name: "vault_ata_base",
          writable: true,
        },
        {
          name: "vault_ata_quote",
          writable: true,
        },
        {
          name: "associated_token_program",
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        },
        {
          name: "token_program",
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111",
        },
        {
          name: "base_token_metadata",
          writable: true,
        },
        {
          name: "metadata_program",
          address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
        },
        {
          name: "rent",
          address: "SysvarRent111111111111111111111111111111111",
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
          name: "proposal_number",
          type: "u16",
        },
        {
          name: "symbol",
          type: "string",
        },
      ],
    },
    {
      name: "swap",
      discriminator: [248, 198, 158, 145, 225, 117, 135, 200],
      accounts: [
        {
          name: "user",
          writable: true,
          signer: true,
        },
        {
          name: "amm",
          writable: true,
        },
        {
          name: "user_base_account",
          writable: true,
        },
        {
          name: "user_quote_account",
          writable: true,
        },
        {
          name: "vault_ata_base",
          writable: true,
        },
        {
          name: "vault_ata_quote",
          writable: true,
        },
        {
          name: "token_program",
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
        {
          name: "token_2022_program",
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
        },
        {
          name: "base_mint",
          writable: true,
        },
        {
          name: "quote_mint",
          writable: true,
        },
        {
          name: "raydium_cp_swap_program",
          address: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
        },
        {
          name: "amm_config",
        },
        {
          name: "authority",
        },
        {
          name: "pool_account",
          writable: true,
        },
        {
          name: "associated_token_program",
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111",
        },
        {
          name: "rent",
          address: "SysvarRent111111111111111111111111111111111",
        },
        {
          name: "token_0_vault",
          writable: true,
        },
        {
          name: "token_1_vault",
          writable: true,
        },
        {
          name: "create_lp_account",
          writable: true,
        },
        {
          name: "create_pool_fee",
          writable: true,
        },
        {
          name: "observation_key",
          writable: true,
        },
        {
          name: "lp_mint",
          writable: true,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: {
              name: "SwapArgs",
            },
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "Amm",
      discriminator: [143, 245, 200, 17, 74, 214, 196, 135],
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
  types: [
    {
      name: "Amm",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "created_at_slot",
            type: "u64",
          },
          {
            name: "base_mint",
            type: "pubkey",
          },
          {
            name: "quote_mint",
            type: "pubkey",
          },
          {
            name: "base_mint_decimals",
            type: "u8",
          },
          {
            name: "quote_mint_decimals",
            type: "u8",
          },
          {
            name: "base_amount",
            type: "u64",
          },
          {
            name: "quote_amount",
            type: "u64",
          },
          {
            name: "v_quote_reserves",
            type: "u64",
          },
          {
            name: "v_base_reserves",
            type: "u64",
          },
          {
            name: "quote_reserves",
            type: "u64",
          },
          {
            name: "base_reserves",
            type: "u64",
          },
          {
            name: "vault_status",
            type: {
              defined: {
                name: "VaultStatus",
              },
            },
          },
        ],
      },
    },
    {
      name: "SwapArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "swap_type",
            type: {
              defined: {
                name: "SwapType",
              },
            },
          },
          {
            name: "input_amount",
            type: "u64",
          },
          {
            name: "output_amount_min",
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
    {
      name: "VaultStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Active",
          },
          {
            name: "Finalized",
          },
          {
            name: "Reverted",
          },
        ],
      },
    },
  ],
};
export type SwapType = {
  buy?: {};
  sell?: {};
};
import { MPL_TOKEN_METADATA_PROGRAM_ID as UMI_MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";

const MPL_TOKEN_METADATA_PROGRAM_ID = toWeb3JsPublicKey(
  UMI_MPL_TOKEN_METADATA_PROGRAM_ID
);

const findMetaplexMetadataPda = async (mint: PublicKey) => {
  const [publicKey] = PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );

  return publicKey;
};

export type CreateAmmClientParams = {
  provider: AnchorProvider;
  ammProgramId?: PublicKey;
};

export type AddLiquiditySimulation = {
  baseAmount: BN;
  quoteAmount: BN;
  expectedLpTokens: BN;
  minLpTokens?: BN;
  maxBaseAmount?: BN;
};

export type SwapSimulation = {
  expectedOut: BN;
  newBaseReserves: BN;
  newQuoteReserves: BN;
  minExpectedOut?: BN;
};

export type RemoveLiquiditySimulation = {
  expectedBaseOut: BN;
  expectedQuoteOut: BN;
  minBaseOut?: BN;
  minQuoteOut?: BN;
};

export class AmmClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    ammProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.program = new Program(
      {
        address: "6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj",
        metadata: {
          name: "amm",
          version: "0.3.0",
          spec: "0.1.0",
          description: "Created with Anchor",
        },
        instructions: [
          {
            name: "create_amm",
            discriminator: [242, 91, 21, 170, 5, 68, 125, 64],
            accounts: [
              {
                name: "user",
                writable: true,
                signer: true,
              },
              {
                name: "amm",
                writable: true,
                pda: {
                  seeds: [
                    {
                      kind: "const",
                      value: [97, 109, 109, 95, 95],
                    },
                    {
                      kind: "account",
                      path: "base_mint",
                    },
                    {
                      kind: "account",
                      path: "quote_mint",
                    },
                  ],
                },
              },
              {
                name: "base_mint",
                writable: true,
              },
              {
                name: "quote_mint",
              },
              {
                name: "vault_ata_base",
                writable: true,
              },
              {
                name: "vault_ata_quote",
                writable: true,
              },
              {
                name: "associated_token_program",
                address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
              },
              {
                name: "token_program",
                address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              },
              {
                name: "system_program",
                address: "11111111111111111111111111111111",
              },
              {
                name: "base_token_metadata",
                writable: true,
              },
              {
                name: "metadata_program",
                address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
              },
              {
                name: "rent",
                address: "SysvarRent111111111111111111111111111111111",
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
                name: "proposal_number",
                type: "u16",
              },
              {
                name: "symbol",
                type: "string",
              },
            ],
          },
          {
            name: "swap",
            discriminator: [248, 198, 158, 145, 225, 117, 135, 200],
            accounts: [
              {
                name: "user",
                writable: true,
                signer: true,
              },
              {
                name: "amm",
                writable: true,
              },
              {
                name: "user_base_account",
                writable: true,
              },
              {
                name: "user_quote_account",
                writable: true,
              },
              {
                name: "vault_ata_base",
                writable: true,
              },
              {
                name: "vault_ata_quote",
                writable: true,
              },
              {
                name: "token_program",
                address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              },
              {
                name: "token_2022_program",
                address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
              },
              {
                name: "base_mint",
                writable: true,
              },
              {
                name: "quote_mint",
                writable: true,
              },
              {
                name: "raydium_cp_swap_program",
                address: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
              },
              {
                name: "amm_config",
              },
              {
                name: "authority",
              },
              {
                name: "pool_account",
                writable: true,
              },
              {
                name: "associated_token_program",
                address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
              },
              {
                name: "system_program",
                address: "11111111111111111111111111111111",
              },
              {
                name: "rent",
                address: "SysvarRent111111111111111111111111111111111",
              },
              {
                name: "token_0_vault",
                writable: true,
              },
              {
                name: "token_1_vault",
                writable: true,
              },
              {
                name: "create_lp_account",
                writable: true,
              },
              {
                name: "create_pool_fee",
                writable: true,
              },
              {
                name: "observation_key",
                writable: true,
              },
              {
                name: "lp_mint",
                writable: true,
              },
            ],
            args: [
              {
                name: "args",
                type: {
                  defined: {
                    name: "SwapArgs",
                  },
                },
              },
            ],
          },
        ],
        accounts: [
          {
            name: "Amm",
            discriminator: [143, 245, 200, 17, 74, 214, 196, 135],
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
        types: [
          {
            name: "Amm",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "bump",
                  type: "u8",
                },
                {
                  name: "created_at_slot",
                  type: "u64",
                },
                {
                  name: "base_mint",
                  type: "pubkey",
                },
                {
                  name: "quote_mint",
                  type: "pubkey",
                },
                {
                  name: "base_mint_decimals",
                  type: "u8",
                },
                {
                  name: "quote_mint_decimals",
                  type: "u8",
                },
                {
                  name: "base_amount",
                  type: "u64",
                },
                {
                  name: "quote_amount",
                  type: "u64",
                },
                {
                  name: "v_quote_reserves",
                  type: "u64",
                },
                {
                  name: "v_base_reserves",
                  type: "u64",
                },
                {
                  name: "quote_reserves",
                  type: "u64",
                },
                {
                  name: "base_reserves",
                  type: "u64",
                },
                {
                  name: "vault_status",
                  type: {
                    defined: {
                      name: "VaultStatus",
                    },
                  },
                },
              ],
            },
          },
          {
            name: "SwapArgs",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "swap_type",
                  type: {
                    defined: {
                      name: "SwapType",
                    },
                  },
                },
                {
                  name: "input_amount",
                  type: "u64",
                },
                {
                  name: "output_amount_min",
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
          {
            name: "VaultStatus",
            type: {
              kind: "enum",
              variants: [
                {
                  name: "Active",
                },
                {
                  name: "Finalized",
                },
                {
                  name: "Reverted",
                },
              ],
            },
          },
        ],
      } as Idl,
      provider
    );
    this.luts = luts;
  }

  getTwap(amm: AmmAccount): BN {
    const vQuoteReserves = new BN(amm.vQuoteReserves);
    const vBaseReserves = new BN(amm.vBaseReserves);
    const price = vQuoteReserves.mul(new BN(100)).div(vBaseReserves);
    return price;
  }
  public static createClient(
    createAutocratClientParams: CreateAmmClientParams
  ): AmmClient {
    let { provider, ammProgramId: programId } = createAutocratClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new AmmClient(provider, programId || AMM_PROGRAM_ID, luts);
  }

  getProgramId(): PublicKey {
    return new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj");
  }

  async createAmm(
    proposal: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    twapInitialObservation: number,
    passOrFail: string,
    uri: string,
    proposal_number: number,
    bata: PublicKey,
    qata: PublicKey,
    twapMaxObservationChangePerUpdate?: number
  ): Promise<PublicKey> {
    if (!twapMaxObservationChangePerUpdate) {
      twapMaxObservationChangePerUpdate = twapInitialObservation * 0.02;
    }
    let [amm] = getAmmAddr(this.getProgramId(), baseMint, quoteMint);

    let hm = await (
      await this.createAmmIx(
        baseMint,
        quoteMint,
        passOrFail,
        uri,
        proposal_number,
        "USDC",
        bata,
        qata
      )
    ).rpc({ skipPreflight: true });
    console.log("hm", hm);
    return amm;
  }
  async createAmmIx(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    passOrFail: string,
    uri: string,
    proposal_number: number,
    symbol: string,
    bata?: PublicKey,
    qata?: PublicKey,
    twapFirstObservationScaled?: BN,
    twapMaxObservationChangePerUpdateScaled?: BN
  ): Promise<MethodsBuilder<AmmIDLType, any>> {
    const [amm, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm__"), baseMint.toBuffer(), quoteMint.toBuffer()],
      this.getProgramId()
    );

    const vaultAtaBase = bata
      ? bata
      : getAssociatedTokenAddressSync(baseMint, amm, true);
    const vaultAtaQuote = qata
      ? qata
      : getAssociatedTokenAddressSync(quoteMint, amm, true);

    const baseTokenMetadata = await findMetaplexMetadataPda(baseMint);

    return this.program.methods
      .createAmm(passOrFail, uri, proposal_number, symbol)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 66600,
        }),
      ])
      .accounts({
        user: this.provider.publicKey,
        amm,
        baseMint,
        quoteMint,
        vaultAtaBase,
        vaultAtaQuote,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        baseTokenMetadata: baseTokenMetadata,
        metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      });
  }

  async swap(
    amm: PublicKey,
    swapType: SwapType,
    inputAmount: number,
    outputAmountMin: number
  ) {
    const storedAmm = await this.getAmm(amm);

    let quoteDecimals = await this.getDecimals(storedAmm.quoteMint);
    let baseDecimals = await this.getDecimals(storedAmm.baseMint);

    let inputAmountScaled: BN;
    let outputAmountMinScaled: BN;
    if (swapType.buy) {
      inputAmountScaled = PriceMath.scale(inputAmount, quoteDecimals);
      outputAmountMinScaled = PriceMath.scale(outputAmountMin, baseDecimals);
    } else {
      inputAmountScaled = PriceMath.scale(inputAmount, baseDecimals);
      outputAmountMinScaled = PriceMath.scale(outputAmountMin, quoteDecimals);
    }

    return await this.swapIx(
      amm,
      storedAmm.baseMint,
      storedAmm.quoteMint,
      swapType,
      inputAmountScaled,
      outputAmountMinScaled
    ).rpc();
  }

  swapIx(
    amm: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    swapType: SwapType,
    inputAmount: BN,
    outputAmountMin: BN
  ) {
    const receivingToken = swapType.buy ? baseMint : quoteMint;
    const TOKEN_PROGRAM_ID = new PublicKey(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    );
    const TOKEN_2022_PROGRAM_ID = new PublicKey(
      "TokenzQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    );
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
      "ATokenGPvRkXzU2Zb1FeP3k3J4J4J4J4J4J4J4J4J4J4"
    );
    const SYSVAR_RENT_PUBKEY = new PublicKey(
      "SysvarRent111111111111111111111111111111111"
    );

    const AMM_CONFIG_SEED = "amm_config";
    const POOL_SEED = "pool";
    const AUTH_SEED = "auth";
    const POOL_VAULT_SEED = "pool_vault";
    const POOL_LP_MINT_SEED = "pool_lp_mint";
    const OBSERVATION_SEED = "observation";

    const amm_config_index = 0;
    const [amm_config_key, __bump1] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(AMM_CONFIG_SEED),
        new Uint8Array(new BN(amm_config_index).toArray("be", 2)),
      ],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );

    const [pool_account_key, __bump2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_SEED),
        amm_config_key.toBuffer(),
        baseMint.toBuffer(),
        quoteMint.toBuffer(),
      ],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );

    const [authority, __bump3] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUTH_SEED)],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );

    const [token_0_vault, __bump4] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_VAULT_SEED),
        pool_account_key.toBuffer(),
        baseMint.toBuffer(),
      ],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );

    const [token_1_vault, __bump5] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_VAULT_SEED),
        pool_account_key.toBuffer(),
        quoteMint.toBuffer(),
      ],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );

    const [lp_mint_key, __bump6] = PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_LP_MINT_SEED), pool_account_key.toBuffer()],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );

    const [observation_key, __bump7] = PublicKey.findProgramAddressSync(
      [Buffer.from(OBSERVATION_SEED), pool_account_key.toBuffer()],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );

    return this.program.methods
      .swap({
        swapType,
        inputAmount,
        outputAmountMin,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 66600,
        }),
      ])
      .accounts({
        user: this.provider.publicKey,
        amm,
        userBaseAccount: getAssociatedTokenAddressSync(
          baseMint,
          this.provider.publicKey,
          true
        ),
        userQuoteAccount: getAssociatedTokenAddressSync(
          quoteMint,
          this.provider.publicKey,
          true
        ),
        vaultAtaBase: getAssociatedTokenAddressSync(baseMint, amm, true),
        vaultAtaQuote: getAssociatedTokenAddressSync(quoteMint, amm, true),
        ammConfig: amm_config_key,
        authority: authority,
        poolAccount: pool_account_key,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        token0Vault: token_0_vault,
        token1Vault: token_1_vault,
        createLpAccount: lp_mint_key,
        createPoolFee: new PublicKey(
          "DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8"
        ),
        observationKey: observation_key,
      })
      .preInstructions([
        // create the receiving token account if it doesn't exist
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(
            receivingToken,
            this.provider.publicKey
          ),
          this.provider.publicKey,
          receivingToken
        ),
      ]);
  }

  // getter functions

  // async getLTWAP(ammAddr: PublicKey): Promise<number> {
  //   const amm = await this.program.account.amm.fetch(ammAddr);
  //   return amm.twapLastObservationUq64X32
  //     .div(new BN(2).pow(new BN(32)))
  //     .toNumber();
  // }

  async getAmm(amm: PublicKey): Promise<AmmAccount> {
    console.log("Fetching Amm account at address:", amm.toBase58());
    const accountInfo = await this.provider.connection.getAccountInfo(amm);
    if (!accountInfo) {
      throw new Error("Account not found");
    }
    console.log("Account data:", accountInfo.data);
    // @ts-ignore
    return await this.program.account.amm.fetch(amm);
  }

  simulateSwap(
    inputAmount: BN,
    swapType: SwapType,
    baseReserves: BN,
    quoteReserves: BN,
    slippageBps?: BN
  ): SwapSimulation {
    if (baseReserves.eqn(0) || quoteReserves.eqn(0)) {
      throw new Error("reserves must be non-zero");
    }

    let inputReserves, outputReserves: BN;
    if (swapType.buy) {
      inputReserves = quoteReserves;
      outputReserves = baseReserves;
    } else {
      inputReserves = baseReserves;
      outputReserves = quoteReserves;
    }

    let inputAmountWithFee: BN;
    if (swapType.buy) {
      inputAmountWithFee = inputAmount
        .mul(quoteReserves)
        .div(baseReserves.sub(inputAmount))
        .muln(99);
    } else {
      inputAmountWithFee = inputAmount
        .mul(quoteReserves)
        .div(baseReserves.add(inputAmount))
        .muln(99);
    }

    let numerator: BN = inputAmountWithFee.mul(outputReserves);
    let denominator: BN = inputReserves.muln(100).add(inputAmountWithFee);

    let expectedOut = numerator.div(denominator);
    let minExpectedOut;
    if (slippageBps) {
      minExpectedOut = PriceMath.subtractSlippage(expectedOut, slippageBps);
    }

    let newBaseReserves, newQuoteReserves: BN;
    if (swapType.buy) {
      newBaseReserves = baseReserves.sub(expectedOut);
      newQuoteReserves = quoteReserves.add(inputAmount);
    } else {
      newBaseReserves = baseReserves.add(inputAmount);
      newQuoteReserves = quoteReserves.sub(expectedOut);
    }

    return {
      expectedOut,
      newBaseReserves,
      newQuoteReserves,
      minExpectedOut,
    };
  }

  simulateRemoveLiquidity(
    lpTokensToBurn: BN,
    baseReserves: BN,
    quoteReserves: BN,
    lpTotalSupply: BN,
    slippageBps?: BN
  ): RemoveLiquiditySimulation {
    const expectedBaseOut = lpTokensToBurn.mul(baseReserves).div(lpTotalSupply);
    const expectedQuoteOut = lpTokensToBurn
      .mul(quoteReserves)
      .div(lpTotalSupply);

    let minBaseOut, minQuoteOut;
    if (slippageBps) {
      minBaseOut = PriceMath.subtractSlippage(expectedBaseOut, slippageBps);
      minQuoteOut = PriceMath.subtractSlippage(expectedQuoteOut, slippageBps);
    }

    return {
      expectedBaseOut,
      expectedQuoteOut,
      minBaseOut,
      minQuoteOut,
    };
  }

  async getDecimals(mint: PublicKey): Promise<number> {
    return unpackMint(mint, await this.provider.connection.getAccountInfo(mint))
      .decimals;
  }
}

import { AnchorProvider, IdlTypes, Program, Wallet } from "@coral-xyz/anchor";
import {
  AccountMeta,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Keypair as kp } from "@metaplex-foundation/umi";
import { PriceMath } from "./utils/priceMath";
import { ProposalInstruction, InitializeDaoParams } from "./types";

import { Autocrat, Autocrat as AutocratIDL } from "./types/autocrat";
import {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./types/conditional_vault";

import BN from "bn.js";
import {
  AMM_PROGRAM_ID,
  AUTOCRAT_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  MAINNET_USDC,
  USDC_DECIMALS,
} from "./constants";
import {
  DEFAULT_CU_PRICE,
  InstructionUtils,
  MaxCUs,
  getAmmAddr,
  getAmmLpMintAddr,
  getDaoTreasuryAddr,
  getProposalAddr,
  getVaultAddr,
  getVaultFinalizeMintAddr,
  getVaultRevertMintAddr,
  uploadConditionalTokenMetadataJson,
} from "./utils";
import { ConditionalVaultClient } from "./ConditionalVaultClient";
import { AmmClient } from "./AmmClient";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
} from "@solana/spl-token";
import { keypairIdentity } from "@metaplex-foundation/umi";

export type CreateClientParams = {
  provider: AnchorProvider;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
  ammProgramId?: PublicKey;
};

export type ProposalVaults = {
  baseVault: PublicKey;
  quoteVault: PublicKey;
};

export class AutocratClient {
  public readonly provider: AnchorProvider;
  public readonly autocrat: Program<Autocrat>;
  public readonly vaultClient: ConditionalVaultClient;
  public readonly ammClient: AmmClient;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    autocratProgramId: PublicKey,
    conditionalVaultProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.autocrat = new Program(
      {
        address: "J7MpMtBj4WVNJ7MQxFj8owfjXAe7BmmdoGgMuh8xMuMU",
        metadata: {
          name: "autocrat",
          version: "0.3.0",
          spec: "0.1.0",
          description: "SVM-based program for running futarchy",
        },
        instructions: [
          {
            name: "execute_proposal",
            discriminator: [186, 60, 116, 133, 108, 128, 111, 28],
            accounts: [
              {
                name: "proposal",
                writable: true,
              },
              {
                name: "dao",
                relations: ["proposal"],
              },
            ],
            args: [],
          },
          {
            name: "finalize_proposal",
            discriminator: [23, 68, 51, 167, 109, 173, 187, 164],
            accounts: [
              {
                name: "proposal",
                writable: true,
              },
              {
                name: "pass_amm",
                relations: ["proposal"],
              },
              {
                name: "fail_amm",
                relations: ["proposal"],
              },
              {
                name: "dao",
                relations: ["proposal"],
              },
              {
                name: "treasury",
                relations: ["dao"],
              },
            ],
            args: [],
          },
          {
            name: "initialize_dao",
            discriminator: [128, 226, 96, 90, 39, 56, 24, 196],
            accounts: [
              {
                name: "dao",
                writable: true,
                signer: true,
              },
              {
                name: "payer",
                writable: true,
                signer: true,
              },
              {
                name: "system_program",
                address: "11111111111111111111111111111111",
              },
              {
                name: "token_mint",
              },
              {
                name: "usdc_mint",
              },
            ],
            args: [
              {
                name: "params",
                type: {
                  defined: {
                    name: "InitializeDaoParams",
                  },
                },
              },
            ],
          },
          {
            name: "initialize_proposal",
            discriminator: [50, 73, 156, 98, 129, 149, 21, 158],
            accounts: [
              {
                name: "proposal",
                writable: true,
                pda: {
                  seeds: [
                    {
                      kind: "const",
                      value: [112, 114, 111, 112, 111, 115, 97, 108],
                    },
                    {
                      kind: "account",
                      path: "proposer",
                    },
                    {
                      kind: "arg",
                      path: "args.nonce",
                    },
                  ],
                },
              },
              {
                name: "dao",
                writable: true,
              },
              {
                name: "fail_amm",
              },
              {
                name: "pass_amm",
              },
              {
                name: "proposer",
                writable: true,
                signer: true,
              },
              {
                name: "system_program",
                address: "11111111111111111111111111111111",
              },
            ],
            args: [
              {
                name: "params",
                type: {
                  defined: {
                    name: "InitializeProposalParams",
                  },
                },
              },
            ],
          },
          {
            name: "update_dao",
            discriminator: [131, 72, 75, 25, 112, 210, 109, 2],
            accounts: [
              {
                name: "dao",
                writable: true,
              },
              {
                name: "treasury",
                signer: true,
                relations: ["dao"],
              },
            ],
            args: [
              {
                name: "dao_params",
                type: {
                  defined: {
                    name: "UpdateDaoParams",
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
          {
            name: "Dao",
            discriminator: [163, 9, 47, 31, 52, 85, 197, 49],
          },
          {
            name: "Proposal",
            discriminator: [26, 94, 189, 187, 116, 136, 53, 33],
          },
        ],
        errors: [
          {
            code: 6000,
            name: "AmmTooOld",
            msg: "Amms must have been created within 5 minutes (counted in slots) of proposal initialization",
          },
          {
            code: 6001,
            name: "InvalidInitialObservation",
            msg: "An amm has an `initial_observation` that doesn't match the `dao`'s config",
          },
          {
            code: 6002,
            name: "InvalidMaxObservationChange",
            msg: "An amm has a `max_observation_change_per_update` that doesn't match the `dao`'s config",
          },
          {
            code: 6003,
            name: "InvalidSettlementAuthority",
            msg: "One of the vaults has an invalid `settlement_authority`",
          },
          {
            code: 6004,
            name: "ProposalTooYoung",
            msg: "Proposal is too young to be executed or rejected",
          },
          {
            code: 6005,
            name: "MarketsTooYoung",
            msg: "Markets too young for proposal to be finalized. TWAP might need to be cranked",
          },
          {
            code: 6006,
            name: "ProposalAlreadyFinalized",
            msg: "This proposal has already been finalized",
          },
          {
            code: 6007,
            name: "InvalidVaultNonce",
            msg: "A conditional vault has an invalid nonce. A nonce should encode the proposal number",
          },
          {
            code: 6008,
            name: "ProposalNotPassed",
            msg: "This proposal can't be executed because it isn't in the passed state",
          },
          {
            code: 6009,
            name: "InsufficientLpTokenBalance",
            msg: "The proposer has fewer pass or fail LP tokens than they requested to lock",
          },
          {
            code: 6010,
            name: "InsufficientLpTokenLock",
            msg: "The LP tokens passed in have less liquidity than the DAO's `min_quote_futarchic_liquidity` or `min_base_futachic_liquidity`",
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
            name: "Dao",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "treasury_pda_bump",
                  type: "u8",
                },
                {
                  name: "treasury",
                  type: "pubkey",
                },
                {
                  name: "token_mint",
                  type: "pubkey",
                },
                {
                  name: "usdc_mint",
                  type: "pubkey",
                },
                {
                  name: "proposal_count",
                  type: "u32",
                },
                {
                  name: "pass_threshold_bps",
                  type: "u16",
                },
                {
                  name: "slots_per_proposal",
                  type: "u64",
                },
                {
                  name: "twap_initial_observation",
                  docs: [
                    "For manipulation-resistance the TWAP is a time-weighted average observation,",
                    "where observation tries to approximate price but can only move by",
                    "`twap_max_observation_change_per_update` per update. Because it can only move",
                    "a little bit per update, you need to check that it has a good initial observation.",
                    "Otherwise, an attacker could create a very high initial observation in the pass",
                    "market and a very low one in the fail market to force the proposal to pass.",
                    "",
                    "We recommend setting an initial observation around the spot price of the token,",
                    "and max observation change per update around 2% the spot price of the token.",
                    "For example, if the spot price of META is $400, we'd recommend setting an initial",
                    "observation of 400 (converted into the AMM prices) and a max observation change per",
                    "update of 8 (also converted into the AMM prices). Observations can be updated once",
                    "a minute, so 2% allows the proposal market to reach double the spot price or 0",
                    "in 50 minutes.",
                  ],
                  type: "u128",
                },
                {
                  name: "twap_max_observation_change_per_update",
                  type: "u128",
                },
                {
                  name: "min_quote_futarchic_liquidity",
                  docs: [
                    "As an anti-spam measure and to help liquidity, you need to lock up some liquidity",
                    "in both futarchic markets in order to create a proposal.",
                    "",
                    "For example, for META, we can use a `min_quote_futarchic_liquidity` of",
                    "5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of",
                    "10 * 1_000_000_000 (10 META).",
                  ],
                  type: "u64",
                },
                {
                  name: "min_base_futarchic_liquidity",
                  type: "u64",
                },
              ],
            },
          },
          {
            name: "InitializeDaoParams",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "twap_initial_observation",
                  type: "u128",
                },
                {
                  name: "twap_max_observation_change_per_update",
                  type: "u128",
                },
                {
                  name: "min_quote_futarchic_liquidity",
                  type: "u64",
                },
                {
                  name: "min_base_futarchic_liquidity",
                  type: "u64",
                },
                {
                  name: "pass_threshold_bps",
                  type: {
                    option: "u16",
                  },
                },
                {
                  name: "slots_per_proposal",
                  type: {
                    option: "u64",
                  },
                },
              ],
            },
          },
          {
            name: "InitializeProposalParams",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "description_url",
                  type: "string",
                },
                {
                  name: "instruction",
                  type: {
                    defined: {
                      name: "ProposalInstruction",
                    },
                  },
                },
                {
                  name: "pass_lp_tokens_to_lock",
                  type: "u64",
                },
                {
                  name: "fail_lp_tokens_to_lock",
                  type: "u64",
                },
                {
                  name: "nonce",
                  type: "u64",
                },
              ],
            },
          },
          {
            name: "Proposal",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "number",
                  type: "u32",
                },
                {
                  name: "proposer",
                  type: "pubkey",
                },
                {
                  name: "description_url",
                  type: "string",
                },
                {
                  name: "slot_enqueued",
                  type: "u64",
                },
                {
                  name: "state",
                  type: {
                    defined: {
                      name: "ProposalState",
                    },
                  },
                },
                {
                  name: "instruction",
                  type: {
                    defined: {
                      name: "ProposalInstruction",
                    },
                  },
                },
                {
                  name: "pass_amm",
                  type: "pubkey",
                },
                {
                  name: "fail_amm",
                  type: "pubkey",
                },
                {
                  name: "dao",
                  type: "pubkey",
                },
                {
                  name: "pass_lp_tokens_locked",
                  type: "u64",
                },
                {
                  name: "fail_lp_tokens_locked",
                  type: "u64",
                },
                {
                  name: "nonce",
                  docs: [
                    "We need to include a per-proposer nonce to prevent some weird proposal",
                    "front-running edge cases. Using a `u64` means that proposers are unlikely",
                    "to run into collisions, even if they generate nonces randomly - I've run",
                    "the math :D",
                  ],
                  type: "u64",
                },
                {
                  name: "pda_bump",
                  type: "u8",
                },
              ],
            },
          },
          {
            name: "ProposalAccount",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "pubkey",
                  type: "pubkey",
                },
                {
                  name: "is_signer",
                  type: "bool",
                },
                {
                  name: "is_writable",
                  type: "bool",
                },
              ],
            },
          },
          {
            name: "ProposalInstruction",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "program_id",
                  type: "pubkey",
                },
                {
                  name: "accounts",
                  type: {
                    vec: {
                      defined: {
                        name: "ProposalAccount",
                      },
                    },
                  },
                },
                {
                  name: "data",
                  type: "bytes",
                },
              ],
            },
          },
          {
            name: "ProposalState",
            type: {
              kind: "enum",
              variants: [
                {
                  name: "Pending",
                },
                {
                  name: "Passed",
                },
                {
                  name: "Failed",
                },
                {
                  name: "Executed",
                },
              ],
            },
          },
          {
            name: "UpdateDaoParams",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "pass_threshold_bps",
                  type: {
                    option: "u16",
                  },
                },
                {
                  name: "slots_per_proposal",
                  type: {
                    option: "u64",
                  },
                },
                {
                  name: "twap_initial_observation",
                  type: {
                    option: "u128",
                  },
                },
                {
                  name: "twap_max_observation_change_per_update",
                  type: {
                    option: "u128",
                  },
                },
                {
                  name: "min_quote_futarchic_liquidity",
                  type: {
                    option: "u64",
                  },
                },
                {
                  name: "min_base_futarchic_liquidity",
                  type: {
                    option: "u64",
                  },
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
      } as unknown as Autocrat,
      provider
    );
    this.vaultClient = ConditionalVaultClient.createClient({
      provider,
      conditionalVaultProgramId,
    });
    this.ammClient = AmmClient.createClient({
      provider,
      ammProgramId: new PublicKey(
        "6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj"
      ),
    });
    this.luts = luts;
  }

  public static createClient(
    createAutocratClientParams: CreateClientParams
  ): AutocratClient {
    let {
      provider,
      autocratProgramId,
      conditionalVaultProgramId,
      ammProgramId,
    } = createAutocratClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new AutocratClient(
      provider,
      autocratProgramId || AUTOCRAT_PROGRAM_ID,
      conditionalVaultProgramId || CONDITIONAL_VAULT_PROGRAM_ID,
      luts
    );
  }

  async getProposal(proposal: PublicKey) {
    return this.autocrat.account.proposal.fetch(proposal);
  }

  async getDao(dao: PublicKey) {
    return this.autocrat.account.dao.fetch(dao);
  }

  getProposalPdas(
    proposal: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    dao: PublicKey
  ): {
    baseVault: PublicKey;
    quoteVault: PublicKey;
    passBaseMint: PublicKey;
    passQuoteMint: PublicKey;
    failBaseMint: PublicKey;
    failQuoteMint: PublicKey;
    passAmm: PublicKey;
    failAmm: PublicKey;
    passLp: PublicKey;
    failLp: PublicKey;
  } {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const [baseVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      proposal,
      baseMint
    );
    const [quoteVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      proposal,
      quoteMint
    );

    const [passBaseMint] = getVaultFinalizeMintAddr(vaultProgramId, baseVault);
    const [passQuoteMint] = getVaultFinalizeMintAddr(
      vaultProgramId,
      quoteVault
    );

    const [failBaseMint] = getVaultRevertMintAddr(vaultProgramId, baseVault);
    const [failQuoteMint] = getVaultRevertMintAddr(vaultProgramId, quoteVault);

    const [passAmm] = getAmmAddr(
      this.ammClient.program.programId,
      passBaseMint,
      passQuoteMint
    );
    const [failAmm] = getAmmAddr(
      this.ammClient.program.programId,
      failBaseMint,
      failQuoteMint
    );

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    return {
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      passAmm,
      failAmm,
      passLp,
      failLp,
    };
  }

  async initializeDao(
    tokenMint: PublicKey,
    tokenPriceUiAmount: number,
    minBaseFutarchicLiquidity: number,
    minQuoteFutarchicLiquidity: number,
    usdcMint: PublicKey = MAINNET_USDC,
    daoKeypair: Keypair = Keypair.generate()
  ): Promise<PublicKey> {
    let tokenDecimals = unpackMint(
      tokenMint,
      await this.provider.connection.getAccountInfo(tokenMint)
    ).decimals;

    let scaledPrice = PriceMath.getAmmPrice(
      tokenPriceUiAmount,
      tokenDecimals,
      USDC_DECIMALS
    );

    console.log(
      PriceMath.getHumanPrice(scaledPrice, tokenDecimals, USDC_DECIMALS)
    );

    await this.initializeDaoIx(
      daoKeypair,
      tokenMint,
      {
        twapInitialObservation: scaledPrice,
        twapMaxObservationChangePerUpdate: scaledPrice.divn(50),
        minQuoteFutarchicLiquidity: new BN(minQuoteFutarchicLiquidity).mul(
          new BN(10).pow(new BN(USDC_DECIMALS))
        ),
        minBaseFutarchicLiquidity: new BN(minBaseFutarchicLiquidity).mul(
          new BN(10).pow(new BN(tokenDecimals))
        ),
        passThresholdBps: null,
        slotsPerProposal: null,
      },
      usdcMint
    ).rpc({ maxRetries: 5 });

    return daoKeypair.publicKey;
  }

  initializeDaoIx(
    daoKeypair: Keypair,
    tokenMint: PublicKey,
    params: InitializeDaoParams,
    usdcMint: PublicKey = MAINNET_USDC
  ) {
    return this.autocrat.methods
      .initializeDao(params)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
        }),
      ])
      .accounts({
        dao: daoKeypair.publicKey,
        tokenMint,
        usdcMint,
      })
      .signers([daoKeypair]);
  }

  async initializeProposal(
    dao: PublicKey,
    descriptionUrl: string,
    instruction: ProposalInstruction,
    baseTokensToLP: BN,
    quoteTokensToLP: BN
  ): Promise<PublicKey> {
    const storedDao = await this.getDao(dao);

    const nonce = new BN(Math.random() * 2 ** 50);

    let [proposal] = getProposalAddr(
      this.autocrat.programId,
      this.provider.publicKey,
      nonce
    );

    const {
      baseVault,
      quoteVault,
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
    } = this.getProposalPdas(
      proposal,
      storedDao.tokenMint,
      storedDao.usdcMint,
      dao
    );
    const payer = Keypair.fromSecretKey(
      new Uint8Array(
        JSON.parse(
          require("fs").readFileSync(
            "/home/ubuntu/.config/solana/id.json",
            "utf-8"
          )
        )
      )
    );
    const passUri = await uploadConditionalTokenMetadataJson(
      this.provider.connection,
      keypairIdentity({
        secretKey: payer.secretKey,
        // @ts-ignore
        publicKey: payer.publicKey,
      }),
      nonce.toNumber(),
      "pStacc"
    );
    const failUri = await uploadConditionalTokenMetadataJson(
      this.provider.connection,
      keypairIdentity({
        secretKey: payer.secretKey,
        // @ts-ignore
        publicKey: payer.publicKey,
      }),
      nonce.toNumber(),
      "fStacc"
    );

    // it's important that these happen in a single atomic transaction
    await this.vaultClient
      .initializeVaultIx(proposal, storedDao.tokenMint)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.vaultClient.initializeVaultIx(proposal, storedDao.usdcMint),
          await this.ammClient.createAmmIx(
            passBaseMint,
            passQuoteMint,
            "p",
            passUri,
            nonce.toNumber(),
            "USDC"
          ),
          await this.ammClient.createAmmIx(
            failBaseMint,
            failQuoteMint,
            "f",
            failUri,
            nonce.toNumber(),

            "USDC"
          )
        )
      )
      .rpc();

    await this.vaultClient
      .mintConditionalTokensIx(baseVault, storedDao.tokenMint, baseTokensToLP)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.vaultClient.mintConditionalTokensIx(
            quoteVault,
            storedDao.usdcMint,
            quoteTokensToLP
          )
        )
      )
      .rpc();

    // this is how many original tokens are created
    const lpTokens = quoteTokensToLP;

    await this.initializeProposalIx(
      descriptionUrl,
      instruction,
      dao,
      storedDao.tokenMint,
      storedDao.usdcMint,
      lpTokens,
      lpTokens,
      nonce
    ).rpc();

    return proposal;
  }

  initializeProposalIx(
    descriptionUrl: string,
    instruction: ProposalInstruction,
    dao: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    passLpTokensToLock: BN,
    failLpTokensToLock: BN,
    nonce: BN
  ) {
    let [proposal] = getProposalAddr(
      this.autocrat.programId,
      this.provider.publicKey,
      nonce
    );
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const { baseVault, quoteVault, passAmm, failAmm } = this.getProposalPdas(
      proposal,
      baseMint,
      quoteMint,
      dao
    );

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    const passLpVaultAccount = getAssociatedTokenAddressSync(
      passLp,
      daoTreasury,
      true
    );
    const failLpVaultAccount = getAssociatedTokenAddressSync(
      failLp,
      daoTreasury,
      true
    );

    return this.autocrat.methods
      .initializeProposal({
        descriptionUrl,
        instruction,
        passLpTokensToLock,
        failLpTokensToLock,
        nonce,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
        }),
      ])
      .accounts({
        dao,
        passAmm,
        failAmm,
        proposer: this.provider.publicKey,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          passLpVaultAccount,
          daoTreasury,
          passLp
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          failLpVaultAccount,
          daoTreasury,
          failLp
        ),
      ]);
  }

  async finalizeProposal(proposal: PublicKey) {
    let storedProposal = await this.getProposal(proposal);
    let storedDao = await this.getDao(storedProposal.dao);

    return this.finalizeProposalIx(
      proposal,
      storedProposal.instruction,
      storedProposal.dao,
      storedDao.tokenMint,
      storedDao.usdcMint,
      storedProposal.proposer
    ).rpc();
  }

  finalizeProposalIx(
    proposal: PublicKey,
    instruction: any,
    dao: PublicKey,
    daoToken: PublicKey,
    usdc: PublicKey,
    proposer: PublicKey
  ) {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;

    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const { baseVault, quoteVault, passAmm, failAmm } = this.getProposalPdas(
      proposal,
      daoToken,
      usdc,
      dao
    );

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    return this.autocrat.methods
      .finalizeProposal()
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
        }),
      ])
      .accounts({
        proposal,
      });
  }

  async executeProposal(proposal: PublicKey) {
    let storedProposal = await this.getProposal(proposal);

    return this.executeProposalIx(
      proposal,
      storedProposal.dao,
      storedProposal.instruction
    ).rpc();
  }

  executeProposalIx(proposal: PublicKey, dao: PublicKey, instruction: any) {
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    return this.autocrat.methods
      .executeProposal()
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
        }),
      ])
      .accounts({
        proposal,
        // daoTreasury,
      })
      .remainingAccounts(
        instruction.accounts
          .concat({
            pubkey: instruction.programId,
            isWritable: false,
            isSigner: false,
          })
          .map((meta: AccountMeta) =>
            meta.pubkey.equals(daoTreasury)
              ? { ...meta, isSigner: false }
              : meta
          )
      );
  }

  // cranks the TWAPs of multiple proposals' markets. there's a limit on the
  // number of proposals you can pass in, which I can't determine rn because
  // there aren't enough proposals on devnet
  async crankProposalMarkets(
    proposals: PublicKey[],
    priorityFeeMicroLamports: number
  ) {
    const amms: PublicKey[] = [];

    for (const proposal of proposals) {
      const storedProposal = await this.getProposal(proposal);
      amms.push(storedProposal.passAmm);
      amms.push(storedProposal.failAmm);
    }

    while (true) {
      let ixs: TransactionInstruction[] = [];

      let tx = new Transaction();
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 4_000 * ixs.length })
      );
      tx.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFeeMicroLamports,
        })
      );
      tx.add(...ixs);
      try {
        await this.provider.sendAndConfirm(tx);
      } catch (err) {
        console.log("err", err);
      }

      await new Promise((resolve) => setTimeout(resolve, 65 * 1000)); // 65,000 milliseconds = 1 minute and 5 seconds
    }
  }
}

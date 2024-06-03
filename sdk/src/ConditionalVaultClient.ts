import BN from "bn.js";

// @ts-nocheck
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";

import {
  CONDITIONAL_VAULT_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
} from "./constants";
import {
  getMetadataAddr,
  getVaultAddr,
  getVaultFinalizeMintAddr,
  getVaultRevertMintAddr,
} from "./utils";

export type CreateVaultClientParams = {
  provider: AnchorProvider;
  conditionalVaultProgramId?: PublicKey;
};

export class ConditionalVaultClient {
  public readonly provider: AnchorProvider;
  public readonly vaultProgram: Program<any>;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    conditionalVaultProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.vaultProgram = new Program<any>(
      {
        address: conditionalVaultProgramId.toBase58(),
        metadata: {
          address: conditionalVaultProgramId.toBase58(),
          version: "0.1.0",
          name: "conditional_vault",
        },
        instructions: [
          {
            name: "initializeConditionalVault",
            accounts: [
              {
                name: "vault",
                isMut: true,
                isSigner: false,
              },
              {
                name: "underlyingTokenMint",
                isMut: false,
                isSigner: false,
              },
              {
                name: "conditionalOnFinalizeTokenMint",
                isMut: true,
                isSigner: true,
              },
              {
                name: "conditionalOnRevertTokenMint",
                isMut: true,
                isSigner: true,
              },
              {
                name: "vaultUnderlyingTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "payer",
                isMut: true,
                isSigner: true,
              },
              {
                name: "tokenProgram",
                isMut: false,
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
            ],
            args: [
              {
                name: "settlementAuthority",
                type: "publicKey",
              },
              {
                name: "nonce",
                type: "u64",
              },
            ],
          },
          {
            name: "addMetadataToConditionalTokens",
            accounts: [
              {
                name: "payer",
                isMut: true,
                isSigner: true,
              },
              {
                name: "vault",
                isMut: true,
                isSigner: false,
              },
              {
                name: "underlyingTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "underlyingTokenMetadata",
                isMut: false,
                isSigner: false,
              },
              {
                name: "conditionalOnFinalizeTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "conditionalOnRevertTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "conditionalOnFinalizeTokenMetadata",
                isMut: true,
                isSigner: false,
              },
              {
                name: "conditionalOnRevertTokenMetadata",
                isMut: true,
                isSigner: false,
              },
              {
                name: "tokenMetadataProgram",
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
            ],
            args: [
              {
                name: "proposalNumber",
                type: "u64",
              },
              {
                name: "onFinalizeUri",
                type: "string",
              },
              {
                name: "onRevertUri",
                type: "string",
              },
            ],
          },
          {
            name: "settleConditionalVault",
            accounts: [
              {
                name: "settlementAuthority",
                isMut: false,
                isSigner: true,
              },
              {
                name: "vault",
                isMut: true,
                isSigner: false,
              },
            ],
            args: [
              {
                name: "newStatus",
                type: {
                  defined: "VaultStatus",
                },
              },
            ],
          },
          {
            name: "mergeConditionalTokensForUnderlyingTokens",
            accounts: [
              {
                name: "vault",
                isMut: false,
                isSigner: false,
              },
              {
                name: "conditionalOnFinalizeTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "conditionalOnRevertTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "vaultUnderlyingTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "authority",
                isMut: false,
                isSigner: true,
              },
              {
                name: "userConditionalOnFinalizeTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "userConditionalOnRevertTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "userUnderlyingTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "tokenProgram",
                isMut: false,
                isSigner: false,
              },
            ],
            args: [
              {
                name: "amount",
                type: "u64",
              },
            ],
          },
          {
            name: "mintConditionalTokens",
            accounts: [
              {
                name: "vault",
                isMut: false,
                isSigner: false,
              },
              {
                name: "conditionalOnFinalizeTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "conditionalOnRevertTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "vaultUnderlyingTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "authority",
                isMut: false,
                isSigner: true,
              },
              {
                name: "userUnderlyingTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "userConditionalOnFinalizeTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "userConditionalOnRevertTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "tokenProgram",
                isMut: false,
                isSigner: false,
              },
            ],
            args: [
              {
                name: "amount",
                type: "u64",
              },
            ],
          },
          {
            name: "redeemConditionalTokensForUnderlyingTokens",
            accounts: [
              {
                name: "vault",
                isMut: false,
                isSigner: false,
              },
              {
                name: "conditionalOnFinalizeTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "conditionalOnRevertTokenMint",
                isMut: true,
                isSigner: false,
              },
              {
                name: "vaultUnderlyingTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "authority",
                isMut: false,
                isSigner: true,
              },
              {
                name: "userConditionalOnFinalizeTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "userConditionalOnRevertTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "userUnderlyingTokenAccount",
                isMut: true,
                isSigner: false,
              },
              {
                name: "tokenProgram",
                isMut: false,
                isSigner: false,
              },
            ],
            args: [],
          },
        ],
        accounts: [
          {
            name: "ConditionalVault",
            type: {
              kind: "struct",
              fields: [
                {
                  name: "status",
                  type: {
                    defined: "VaultStatus",
                  },
                },
                {
                  name: "settlementAuthority",
                  docs: [
                    "The account that can either finalize the vault to make conditional tokens",
                    "redeemable for underlying tokens or revert the vault to make deposit",
                    "slips redeemable for underlying tokens.",
                  ],
                  type: "publicKey",
                },
                {
                  name: "underlyingTokenMint",
                  docs: [
                    "The mint of the tokens that are deposited into the vault.",
                  ],
                  type: "publicKey",
                },
                {
                  name: "nonce",
                  docs: [
                    "A nonce to allow a single account to be the settlement authority of multiple",
                    "vaults with the same underlying token mints.",
                  ],
                  type: "u64",
                },
                {
                  name: "underlyingTokenAccount",
                  docs: ["The vault's storage account for deposited funds."],
                  type: "publicKey",
                },
                {
                  name: "conditionalOnFinalizeTokenMint",
                  type: "publicKey",
                },
                {
                  name: "conditionalOnRevertTokenMint",
                  type: "publicKey",
                },
                {
                  name: "pdaBump",
                  type: "u8",
                },
              ],
            },
          },
        ],
        types: [
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
        errors: [
          {
            code: 6000,
            name: "InsufficientUnderlyingTokens",
            msg: "Insufficient underlying token balance to mint this amount of conditional tokens",
          },
          {
            code: 6001,
            name: "InvalidVaultUnderlyingTokenAccount",
            msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`",
          },
          {
            code: 6002,
            name: "InvalidConditionalTokenMint",
            msg: "This conditional token mint is not this vault's conditional token mint",
          },
          {
            code: 6003,
            name: "CantRedeemConditionalTokens",
            msg: "Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens",
          },
          {
            code: 6004,
            name: "VaultAlreadySettled",
            msg: "Once a vault has been settled, its status as either finalized or reverted cannot be changed",
          },
        ],
      },
      provider
    );
    this.luts = luts;
  }

  public static createClient(
    createVaultClientParams: CreateVaultClientParams
  ): ConditionalVaultClient {
    let { provider, conditionalVaultProgramId } = createVaultClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new ConditionalVaultClient(
      provider,
      conditionalVaultProgramId || CONDITIONAL_VAULT_PROGRAM_ID,
      luts
    );
  }

  async getVault(vault: PublicKey) {
    // @ts-ignore
    return this.vaultProgram.account.conditionalVault.fetch(vault);
  }

  async mintConditionalTokens(
    vault: PublicKey,
    uiAmount: number,
    user?: PublicKey | Keypair
  ) {
    const storedVault = await this.getVault(vault);

    return (
      this.mintConditionalTokensIx(
        vault,
        storedVault.underlyingTokenMint,
        new BN(uiAmount).mul(new BN(10).pow(new BN(storedVault.decimals))),
        user
      )
        // .preInstructions([
        //   createAssociatedTokenAccountIdempotentInstruction(this.provider.publicKey, )
        // ])
        .rpc()
    );
  }

  mintConditionalTokensIx(
    vault: PublicKey,
    underlyingTokenMint: PublicKey,
    amount: BN,
    user?: PublicKey | Keypair
  ) {
    let userPubkey;
    if (!user) {
      userPubkey = this.provider.publicKey;
    } else if (user instanceof Keypair) {
      userPubkey = user.publicKey;
    } else {
      userPubkey = user;
    }

    const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
      this.vaultProgram.programId,
      vault
    );
    const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
      this.vaultProgram.programId,
      vault
    );

    let userConditionalOnFinalizeTokenAccount = getAssociatedTokenAddressSync(
      conditionalOnFinalizeTokenMint,
      userPubkey
    );

    let userConditionalOnRevertTokenAccount = getAssociatedTokenAddressSync(
      conditionalOnRevertTokenMint,
      userPubkey
    );

    // @ts-ignore
    let ix = this.vaultProgram.methods
      .mintConditionalTokens(amount)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
        }),
      ])
      .accounts({
        authority: userPubkey,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        vaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          underlyingTokenMint,
          vault,
          true
        ),
        userUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          underlyingTokenMint,
          userPubkey,
          true
        ),
        conditionalOnFinalizeTokenMint,
        userConditionalOnFinalizeTokenAccount,
        conditionalOnRevertTokenMint,
        userConditionalOnRevertTokenAccount,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          userPubkey,
          userConditionalOnFinalizeTokenAccount,
          userPubkey,
          conditionalOnFinalizeTokenMint
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          userPubkey,
          userConditionalOnRevertTokenAccount,
          userPubkey,
          conditionalOnRevertTokenMint
        ),
      ]);
    if (user instanceof Keypair) {
      ix = ix.signers([user]);
    }

    return ix;
  }

  initializeVaultIx(
    settlementAuthority: PublicKey,
    underlyingTokenMint: PublicKey
  ): MethodsBuilder<any, any> {
    const [vault] = getVaultAddr(
      this.vaultProgram.programId,
      settlementAuthority,
      underlyingTokenMint
    );

    const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
      this.vaultProgram.programId,
      vault
    );
    const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
      this.vaultProgram.programId,
      vault
    );

    const vaultUnderlyingTokenAccount = getAssociatedTokenAddressSync(
      underlyingTokenMint,
      vault,
      true
    );

    return this.vaultProgram.methods
      .initializeConditionalVault({ settlementAuthority })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
        }),
      ])
      .accounts({
        vault,
        underlyingTokenMint,
        vaultUnderlyingTokenAccount,
        conditionalOnFinalizeTokenMint,
        conditionalOnRevertTokenMint,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        payer: this.provider.publicKey,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          vaultUnderlyingTokenAccount,
          vault,
          underlyingTokenMint
        ),
      ]);
  }

  addMetadataToConditionalTokensIx(
    vault: PublicKey,
    underlyingTokenMint: PublicKey,
    proposalNumber: number,
    onFinalizeUri: string,
    onRevertUri: string
  ) {
    const [underlyingTokenMetadata] = getMetadataAddr(underlyingTokenMint);

    const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
      this.vaultProgram.programId,
      vault
    );
    const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
      this.vaultProgram.programId,
      vault
    );

    const [conditionalOnFinalizeTokenMetadata] = getMetadataAddr(
      conditionalOnFinalizeTokenMint
    );

    const [conditionalOnRevertTokenMetadata] = getMetadataAddr(
      conditionalOnRevertTokenMint
    );

    return this.vaultProgram.methods
      .addMetadataToConditionalTokens({
        proposalNumber: new BN(proposalNumber),
        onFinalizeUri,
        onRevertUri,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
        }),
      ])
      .accounts({
        payer: this.provider.publicKey,
        vault,
        underlyingTokenMint,
        underlyingTokenMetadata,
        conditionalOnFinalizeTokenMint,
        conditionalOnRevertTokenMint,
        conditionalOnFinalizeTokenMetadata,
        conditionalOnRevertTokenMetadata,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      });
  }

  async initializeVault(
    settlementAuthority: PublicKey,
    underlyingTokenMint: PublicKey
  ): Promise<PublicKey> {
    const [vault] = getVaultAddr(
      this.vaultProgram.programId,
      settlementAuthority,
      underlyingTokenMint
    );

    await this.initializeVaultIx(
      settlementAuthority,
      underlyingTokenMint
    ).rpc();

    return vault;
  }
}

// @ts-nocheck
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";

import {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./types/conditional_vault";

import BN from "bn.js";
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
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

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
    this.vaultProgram = new Program<any>(ConditionalVaultIDL, provider);
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

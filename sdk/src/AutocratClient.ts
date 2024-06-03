// @ts-nocheck
import BN from "bn.js";
import fs from "fs";

// @ts-nocheck
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { keypairIdentity } from "@metaplex-foundation/umi";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
} from "@solana/spl-token";
import {
  AccountMeta,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { AmmClient, createMint } from "./AmmClient";
import {
  AUTOCRAT_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  MAINNET_USDC,
  USDC_DECIMALS,
} from "./constants";
import { AmmAccount, InitializeDaoParams, ProposalInstruction } from "./types";
import { Autocrat } from "./types/autocrat";
import {
  getAmmAddr,
  getAmmLpMintAddr,
  getDaoTreasuryAddr,
  getProposalAddr,
  getVaultAddr,
  getVaultFinalizeMintAddr,
  getVaultRevertMintAddr,
  InstructionUtils,
  uploadConditionalTokenMetadataJson,
} from "./utils";
import { PriceMath } from "./utils/priceMath";

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
  public readonly autocrat: Program;
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
      JSON.parse(
        fs.readFileSync(
          "//home/ubuntu/funarchy/target/idl/autocrat.json",
          "utf8"
        )
      ),
      provider
    );
    this.ammClient = AmmClient.createClient({
      provider,
      ammProgramId: new PublicKey(
        "62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH"
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

  async getProposalPdas(
    proposal: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    dao: PublicKey
  ): Promise<{
    passBaseMint: PublicKey;
    passQuoteMint: PublicKey;
    failBaseMint: PublicKey;
    failQuoteMint: PublicKey;
    passAmm: AmmAccount;
    failAmm: AmmAccount;
  }> {
    const passAmmKp = Keypair.generate();
    const failAmmKp = Keypair.generate();

    const [passAmm, _1] = getAmmAddr(
      this.ammClient.program.programId,
      passAmmKp.publicKey,
      quoteMint
    );

    const [failAmm, _] = getAmmAddr(
      this.ammClient.program.programId,
      failAmmKp.publicKey,
      quoteMint
    );
    const passBaseMint = await createMint(
      this.provider.connection,
      Keypair.fromSecretKey(
        new Uint8Array(
          JSON.parse(
            require("fs").readFileSync(
              process.env.ANCHOR_WALLET as string,
              "utf-8"
            )
          )
        )
      ),
      passAmm,
      passAmm,
      6,
      passAmmKp
    );
    const failBaseMint = await createMint(
      this.provider.connection,
      Keypair.fromSecretKey(
        new Uint8Array(
          JSON.parse(
            require("fs").readFileSync(
              process.env.ANCHOR_WALLET as string,
              "utf-8"
            )
          )
        )
      ),
      failAmm,
      failAmm,
      6,
      failAmmKp
    );

    this.ammClient.createAmm(
      proposal,
      passBaseMint,
      quoteMint,
      500_000_000_000,

      "p",
      "http://google.com",
      1,
      undefined,
      undefined,
      undefined,
      [
        createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          getAssociatedTokenAddressSync(passBaseMint, passAmm, true),
          passAmm,
          passBaseMint
        ),
        createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          getAssociatedTokenAddressSync(quoteMint, passAmm, true),
          passAmm,
          quoteMint
        ),
      ]
    );

    this.ammClient.createAmm(
      proposal,
      failBaseMint,
      quoteMint,
      500_000_000_000,

      "p",
      "http://google.com",
      1,
      undefined,
      undefined,
      undefined,
      [
        createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          getAssociatedTokenAddressSync(failBaseMint, failAmm, true),
          failAmm,
          failBaseMint
        ),
        createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          getAssociatedTokenAddressSync(quoteMint, failAmm, true),
          failAmm,
          quoteMint
        ),
      ]
    );
    return {
      passBaseMint: passBaseMint,
      passQuoteMint: quoteMint,
      failBaseMint,
      failQuoteMint: quoteMint,
      passAmm,
      failAmm,
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

    (
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
      )
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
    } = await this.getProposalPdas(
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
    /*
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
*/
    const [amm1, bump1] = getAmmAddr(
      this.ammClient.program.programId,
      passBaseMint,
      passQuoteMint
    );

    const [amm2, bump2] = getAmmAddr(
      this.ammClient.program.programId,
      failBaseMint,
      failQuoteMint
    );

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
    );
    return proposal;
  }

  async initializeProposalIx(
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
    const { baseVault, quoteVault, passAmm, failAmm } =
      await this.getProposalPdas(proposal, baseMint, quoteMint, dao);

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
      ])
      .rpc();
  }

  async finalizeProposal(proposal: PublicKey) {
    let storedProposal = await this.getProposal(proposal);
    let storedDao = await this.getDao(storedProposal.dao);

    return (
      await this.finalizeProposalIx(
        proposal,
        storedProposal.instruction,
        storedProposal.dao,
        storedDao.tokenMint,
        storedDao.usdcMint,
        storedProposal.proposer
      )
    ).rpc();
  }

  async finalizeProposalIx(
    proposal: PublicKey,
    instruction: any,
    dao: PublicKey,
    daoToken: PublicKey,
    usdc: PublicKey,
    proposer: PublicKey
  ) {
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const { baseVault, quoteVault, passAmm, failAmm } =
      await this.getProposalPdas(proposal, daoToken, usdc, dao);

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
}

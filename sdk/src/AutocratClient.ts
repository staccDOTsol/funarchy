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

import { Autocrat, IDL as AutocratIDL } from "./types/autocrat";
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
    ammProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.autocrat = new Program<Autocrat>(
      AutocratIDL,
      autocratProgramId,
      provider
    );
    this.vaultClient = ConditionalVaultClient.createClient({
      provider,
      conditionalVaultProgramId,
    });
    this.ammClient = AmmClient.createClient({ provider, ammProgramId });
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
      ammProgramId || AMM_PROGRAM_ID,
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
        proposal,
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
        passAmm,
        failAmm,
        dao,
        treasury: daoTreasury,
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
        dao,
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

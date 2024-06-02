import BN from 'bn.js';
import fs from 'fs';

// @ts-nocheck
import {
  AnchorProvider,
  Program,
  utils,
} from '@coral-xyz/anchor';
import {
  MethodsBuilder,
} from '@coral-xyz/anchor/dist/cjs/program/namespace/methods';
import {
  MPL_TOKEN_METADATA_PROGRAM_ID as UMI_MPL_TOKEN_METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata';
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  unpackMint,
} from '@solana/spl-token';
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from '@solana/web3.js';

import { AMM_PROGRAM_ID } from './constants';
import { AmmAccount } from './types/';
import { Amm as AmmIDLType } from './types/amm';
import { PriceMath } from './utils/priceMath';

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

export type SwapType = {
  buy?: {};
  sell?: {};
};

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
      JSON.parse(
        fs.readFileSync("//home/ubuntu/funarchy/target/idl/amm.json", "utf8")
      ),
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
    return new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH");
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
    bump: number,
    twapMaxObservationChangePerUpdate?: number
  ): Promise<PublicKey> {
    if (!twapMaxObservationChangePerUpdate) {
      twapMaxObservationChangePerUpdate = twapInitialObservation * 0.02;
    }

    var hm = await (
      await this.createAmmIx(
        baseMint,
        quoteMint,
        passOrFail,
        uri,
        proposal_number,
        "USDC",
        bump
      )
    ).rpc({ skipPreflight: true });
    console.log("hm", hm);
  }
  async createAmmIx(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    passOrFail: string,
    uri: string,
    proposal_number: number,
    symbol: string,
    bump: number,
    bata?: PublicKey,
    qata?: PublicKey,
    twapFirstObservationScaled?: BN,
    twapMaxObservationChangePerUpdateScaled?: BN
  ): Promise<MethodsBuilder<AmmIDLType, any>> {
    const [amm, _bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm__"), baseMint.toBuffer(), quoteMint.toBuffer()],
      this.getProgramId()
    );

    const vaultAtaBase = getAssociatedTokenAddressSync(baseMint, amm, true);
    const vaultAtaQuote = getAssociatedTokenAddressSync(quoteMint, amm, true);

    const baseTokenMetadata = await findMetaplexMetadataPda(baseMint);

    return this.program.methods
      .createAmm(passOrFail, uri, proposal_number, symbol, bump)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 66600,
        }),
        createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          getAssociatedTokenAddressSync(baseMint, amm, true),
          amm,
          baseMint
        ),
        createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          getAssociatedTokenAddressSync(quoteMint, amm, true),
          amm,
          quoteMint
        ),
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
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );

    const [pool_account_key, __bump2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_SEED),
        amm_config_key.toBuffer(),
        baseMint.toBuffer(),
        quoteMint.toBuffer(),
      ],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );

    const [authority, __bump3] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUTH_SEED)],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );

    const [token_0_vault, __bump4] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_VAULT_SEED),
        pool_account_key.toBuffer(),
        baseMint.toBuffer(),
      ],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );

    const [token_1_vault, __bump5] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_VAULT_SEED),
        pool_account_key.toBuffer(),
        quoteMint.toBuffer(),
      ],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );

    const [lp_mint_key, __bump6] = PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_LP_MINT_SEED), pool_account_key.toBuffer()],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );

    const [observation_key, __bump7] = PublicKey.findProgramAddressSync(
      [Buffer.from(OBSERVATION_SEED), pool_account_key.toBuffer()],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
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
      .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        this.provider.publicKey,
        getAssociatedTokenAddressSync(
          baseMint,
          this.provider.publicKey
        ),
        this.provider.publicKey,
        baseMint
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        this.provider.publicKey,
        getAssociatedTokenAddressSync(
          quoteMint,
          this.provider.publicKey
        ),
        this.provider.publicKey,
        quoteMint
      )
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
        baseMint,
        quoteMint,
        lpMint: lp_mint_key,
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

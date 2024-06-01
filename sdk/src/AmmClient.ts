import { AnchorProvider, IdlTypes, Program, utils } from "@coral-xyz/anchor";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { Amm as AmmIDLType, IDL as AmmIDL } from "./types/amm";

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
} from "@solana/spl-token";
import { PriceMath } from "./utils/priceMath";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

export type SwapType = LowercaseKeys<IdlTypes<AmmIDLType>["SwapType"]>;
import {
  Key,
  MPL_TOKEN_METADATA_PROGRAM_ID as UMI_MPL_TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
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
  public readonly program: Program<AmmIDLType>;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    ammProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.program = new Program<AmmIDLType>(AmmIDL, ammProgramId, provider);
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
    return this.program.programId;
  }

  async createAmm(
    proposal: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    twapInitialObservation: number,
    passOrFail: string,
    uri: string,
    proposal_number: number,
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
        "USDC"
      )
    ).instruction();
    const tx = new Transaction().add(hm);
    tx.feePayer = this.provider.publicKey;
    tx.recentBlockhash = (
      await new Connection(
        process.env.ANCHOR_PROVIDER as string,
        "confirmed"
      ).getLatestBlockhash()
    ).blockhash;
    tx.sign(
      Keypair.fromSecretKey(
        new Uint8Array(
          JSON.parse(
            require("fs").readFileSync(
              process.env.ANCHOR_WALLET as string,
              "utf-8"
            )
          )
        )
      )
    );
    await new Connection(
      process.env.ANCHOR_PROVIDER as string,
      "confirmed"
    ).sendRawTransaction(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    );
    console.log("hm", hm);
    return amm;
  }
  // both twap values need to be scaled beforehand
  async createAmmIx(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    passOrFail: string,
    uri: string,
    proposal_number: number,
    symbol: string,
    twapFirstObservationScaled?: BN,
    twapMaxObservationChangePerUpdateScaled?: BN
  ): Promise<MethodsBuilder<AmmIDLType, any>> {
    let [amm] = getAmmAddr(this.getProgramId(), baseMint, quoteMint);

    let vaultAtaBase = getAssociatedTokenAddressSync(baseMint, amm, true);
    let vaultAtaQuote = getAssociatedTokenAddressSync(quoteMint, amm, true);

    const baseTokenMetadata = await findMetaplexMetadataPda(baseMint);

    return this.program.methods
      .createAmm(passOrFail, uri, proposal_number, symbol)

      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
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
        associatedTokenProgram: new PublicKey(
          "TokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        ),
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
      this.program.programId
    );

    const [pool_account_key, __bump2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_SEED),
        amm_config_key.toBuffer(),
        baseMint.toBuffer(),
        quoteMint.toBuffer(),
      ],
      this.program.programId
    );

    const [authority, __bump3] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUTH_SEED)],
      this.program.programId
    );

    const [token_0_vault, __bump4] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_VAULT_SEED),
        pool_account_key.toBuffer(),
        baseMint.toBuffer(),
      ],
      this.program.programId
    );

    const [token_1_vault, __bump5] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_VAULT_SEED),
        pool_account_key.toBuffer(),
        quoteMint.toBuffer(),
      ],
      this.program.programId
    );

    const [lp_mint_key, __bump6] = PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_LP_MINT_SEED), pool_account_key.toBuffer()],
      this.program.programId
    );

    const [observation_key, __bump7] = PublicKey.findProgramAddressSync(
      [Buffer.from(OBSERVATION_SEED), pool_account_key.toBuffer()],
      this.program.programId
    );

    return this.program.methods
      .swap({
        swapType,
        inputAmount,
        outputAmountMin,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666,
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

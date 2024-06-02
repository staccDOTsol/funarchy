// @ts-nocheck

import { assert } from 'chai';

import * as anchor from '@coral-xyz/anchor';
import {
  AnchorProvider,
  BN,
} from '@coral-xyz/anchor';
import { MAINNET_USDC as USDC } from '@metadaoproject/futarchy';
import {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  AmmClient,
  createMint,
  getAmmAddr,
  PriceMath,
} from '../sdk/src';
import { expectError } from './utils/utils';

const META_DECIMALS = 6;
const USDC_DECIMALS = 6;

describe("amm", async function () {
  let provider: AnchorProvider,
    ammClient: AmmClient,
    META: PublicKey,
    payer: Keypair,
    connection: Connection,
    proposal: PublicKey,
    amm: PublicKey,
    
    lpMint: PublicKey;

  before(async function () {
    connection = new Connection(process.env.ANCHOR_PROVIDER as string, "confirmed"),
    payer = Keypair.fromSecretKey(
      new Uint8Array(
        JSON.parse(require('fs').readFileSync(process.env.ANCHOR_WALLET as string, "utf-8"))
      )
    );

    provider = new AnchorProvider(connection, new anchor.Wallet(payer), {})
    ammClient = await AmmClient.createClient({ provider, ammProgramId: new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH") });
  });

  beforeEach(async function () {
    
    let userUsdcAccount = await getAssociatedTokenAddressSync(
      USDC,
      payer.publicKey,
      true,
    
    );
    console.log(userUsdcAccount)
      const mkp = Keypair.generate()
    var  [amm, bump] = getAmmAddr(
      ammClient.program.programId,
      mkp.publicKey,
      USDC,
    );

    META = await createMint(
      connection,
      payer,
      amm,
      amm,
      META_DECIMALS,
      mkp,
      {
        skipPreflight: false
      }
    )
  getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      META,
      payer.publicKey,
      true,

      "recent",
      {
        skipPreflight: false
      }
    );
 const qata =   await getAssociatedTokenAddressSync(

     USDC,
     amm,
     true)
   console.log(qata)

const bata = await  getAssociatedTokenAddressSync(
    META,
    amm,
    true,
  );
  
console.log(bata)
    proposal = Keypair.generate().publicKey;
    amm = await ammClient
    .createAmm(
      proposal,
      META,
      USDC,
      500_000_000_000,
      
      "p",
      "http://google.com",
      1,
      bata,
      qata,
      bump

    );
  });

  describe("#create_amm", async function () {
    it("creates an amm", async function () {
      let expectedInitialObservation = new BN(500_000_000_000);
      let expectedMaxObservationChangePerUpdate = new BN(10_000_000_000);

      let bump: number;
      [amm, bump] = getAmmAddr(
        ammClient.program.programId,
        META,
        USDC,
      );
      const ammAcc = await ammClient.getAmm(amm);

      assert.equal(ammAcc.bump, bump);
      assert.equal(ammAcc.baseMint.toBase58(), META.toBase58());
      assert.equal(ammAcc.quoteMint.toBase58(), USDC.toBase58());
      assert.equal(ammAcc.baseMintDecimals, 6);
      assert.equal(ammAcc.quoteMintDecimals, 6);
    });

    it("fails to create an amm with two identical mints", async function () {
      let [
        twapFirstObservationScaled,
        twapMaxObservationChangePerUpdateScaled,
      ] = PriceMath.getAmmPrices(META_DECIMALS, USDC_DECIMALS, 100, 1);

      const callbacks = expectError(
        "SameTokenMints",
        "create AMM succeeded despite same token mints"
      );
        const [_, bump] = getAmmAddr(
        ammClient.program.programId,
        META,
        META,
      );
      let proposal = Keypair.generate().publicKey;

      (await ammClient
        .createAmmIx(
          META,
          META,
          "p",
          "http://google.com",
          0,

        "Manifesto",
        bump
        ))
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });
  });

  describe("#swap", async function () {
    beforeEach(async function () {
      await ammClient
        .swap(amm, { buy: {} }, 0.01, 1)
    });

    it("fails when you have insufficient balance", async () => {
      let callbacks = expectError(
        "InsufficientBalance",
        "we should have caught a user not having enough balance"
      );

      await ammClient
        .swap(amm, { buy: {} }, 0.01, 1)
        .then(callbacks[0], callbacks[1]);
        await ammClient
          .swap(amm, { buy: {} }, 0.01, 1)
          .then(callbacks[0], callbacks[1]);

          await ammClient
          .swap(amm, { buy: {} }, 0.01, 1)
          .then(callbacks[0], callbacks[1]);
    

      await ammClient
        .swap(amm, { sell: {} }, 1, 1)
        .then(callbacks[0], callbacks[1]);
    });

    it("buys", async function () {
      // USDC amount = 10,000
      // META amount = 10
      // k = (10,000 * 10) = 100,000
      // swap amount = 100
      // swap amount after fees = 99
      // new USDC amount = 10,099
      // new META amount = 100,000 / 10,099 = 9.9019...
      // meta out = 10 - 9.9019 = 0.098029507

      const expectedOut = 0.098029507;

      const storedAmm = await ammClient.getAmm(amm);
      let sim = ammClient.simulateSwap(
        new BN(100 * 10 ** 6),
        { buy: {} },
        storedAmm.vBaseReserves,
        storedAmm.vQuoteReserves
      );
      assert.equal(
        sim.expectedOut.toString(),
        new BN(expectedOut * 10 ** 9).toString()
      );

      // first, show that it fails when we expect 1 hanson too much
      let callbacks = expectError(
        "SwapSlippageExceeded",
        "we got back too many tokens from the AMM"
      );

      await ammClient
        .swap(amm, { buy: {} }, 0.01, expectedOut + 0.000000001)
        .then(callbacks[0], callbacks[1]);

      await ammClient.swap(amm, { buy: {} }, 0.01, expectedOut);

    });

    it("sells", async function () {
      // USDC amount = 10,000
      // META amount = 10
      // k = (10,000 * 10) = 100,000
      // swap amount = 1
      // swap amount after fees = 0.99
      // new META amount = 10.99
      // new USDC amount = 100,000 / 10.99 = 9099.181074
      // usdc out = 10,000 - 9099.181074 = 900.818926

      const expectedOut = 900.818926;

      let callbacks = expectError(
        "SwapSlippageExceeded",
        "we got back too many tokens from the AMM"
      );

      await ammClient
        .swap(amm, { sell: {} }, 1, expectedOut + 0.000001)
        .then(callbacks[0], callbacks[1]);

      await ammClient.swap(amm, { sell: {} }, 1, expectedOut);

    });

    it("swap base to quote and back, should not be profitable", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );
      const ammEnd = await ammClient.getAmm(amm);

      let startingBaseSwapAmount = 1 * 10 ** 9;

      await ammClient
        .swapIx(
          amm,
          META,
          USDC,
          { sell: {} },
          new BN(startingBaseSwapAmount),
          new BN(1)
        )
        .rpc();

      const ammMiddle = await ammClient.getAmm(amm);
      let quoteReceived =
        permissionlessAmmStart.vQuoteReserves.toNumber() -
        ammMiddle.vQuoteReserves.toNumber();

      await ammClient
        .swapIx(amm, META, USDC, { buy: {} }, new BN(quoteReceived), new BN(1))
        .rpc();

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );
      let baseReceived =
        ammMiddle.vBaseReserves.toNumber() -
        permissionlessAmmEnd.vBaseReserves.toNumber();

      assert.isBelow(baseReceived, startingBaseSwapAmount);
      assert.isAbove(baseReceived, startingBaseSwapAmount * 0.98); // 1% swap fee both ways
    });

    it("swap quote to base and back, should not be profitable", async function () {
      const ammStart = await ammClient.getAmm(amm);

      let startingQuoteSwapAmount = 1 * 10 ** 6;

      await ammClient
        .swapIx(
          amm,
          META,
          USDC,
          { buy: {} },
          new BN(startingQuoteSwapAmount),
          new BN(1)
        )
        .rpc();

      const ammMiddle = await ammClient.getAmm(amm);
      let baseReceived =
        ammStart.vBaseReserves.toNumber() - ammMiddle.vBaseReserves.toNumber();

      await ammClient
        .swapIx(amm, META, USDC, { sell: {} }, new BN(baseReceived), new BN(1))
        .rpc();

      const ammEnd = await ammClient.getAmm(amm);
      let quoteReceived =
        ammMiddle.vQuoteReserves.toNumber() - ammEnd.vQuoteReserves.toNumber();

      assert.isBelow(quoteReceived, startingQuoteSwapAmount);
      assert.isAbove(quoteReceived, startingQuoteSwapAmount * 0.98);
    });
  });
});


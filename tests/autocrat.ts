import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { assert } from "chai";

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  getMint,
  getAccount,mintTo
} from "@solana/spl-token";


import { advanceBySlots, expectError } from "./utils/utils";
import { Autocrat } from "../target/types/autocrat";
const { PublicKey, Keypair } = anchor.web3;

import {
  AUTOCRAT_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  AmmClient,
  getAmmAddr,
  getAmmLpMintAddr,
  getVaultAddr,
} from "../sdk/dist";
import { PriceMath } from "../sdk/dist";
import { AutocratClient, ConditionalVaultClient } from "../sdk/dist";
import {
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  Connection,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const AutocratIDL: Autocrat = require("../target/idl/autocrat.json");

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;


// this test file isn't 'clean' or DRY or whatever; sorry!

const AUTOCRAT_MIGRATOR_PROGRAM_ID = new PublicKey(
  "MigRDW6uxyNMDBD8fX2njCRyJC4YZk2Rx9pDUZiAESt"
);

const ONE_META = new BN(1_000_000_000);
const ONE_USDC = new BN(1_000_000);

describe("autocrat", async function () {
  let provider,
    autocrat,
    payer,
    connection,
    dao,
    mertdDao,
    daoTreasury,
    mertdDaoTreasury,
    META,
    USDC,
    MERTD,
    vaultProgram,
    ammClient: AmmClient,
    autocratClient: AutocratClient,
    vaultClient: ConditionalVaultClient,
    migrator,
    treasuryMetaAccount,
    treasuryUsdcAccount,
    mertdTreasuryMertdAccount,
    mertdTreasuryUsdcAccount;

  before(async function () {
    payer = Keypair.fromSecretKey(
      new Uint8Array(
        JSON.parse(require('fs').readFileSync(process.env.ANCHOR_WALLET as string, "utf-8"))
      )
    );
     connection = new Connection(process.env.ANCHOR_PROVIDER as string, "confirmed")
    provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), {})
    anchor.setProvider(provider);

    ammClient = AmmClient.createClient({ provider });
    vaultClient = ConditionalVaultClient.createClient({ provider });
    autocratClient = await AutocratClient.createClient({ provider });

    autocrat = new anchor.Program<Autocrat>(
      AutocratIDL,
      AUTOCRAT_PROGRAM_ID,
      provider
    );


    payer = provider.wallet.payer;

    USDC = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    META = await createMint(provider.connection, payer, dao, dao, 9);

    MERTD = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    await createAssociatedTokenAccount(
      provider.connection,
      payer,
      META,
      payer.publicKey
    );
    await createAssociatedTokenAccount(
      provider.connection,  // this is undefined
      payer,
      USDC,
      payer.publicKey
    );

    // 1000 META
    await mintTo(
      provider.connection,
      payer,
      META,
      getAssociatedTokenAddressSync(META, payer.publicKey),
      payer.publicKey,
      1_000n * 1_000_000_000n
    );
    // 200,000 USDC
    await mintTo(
      provider.connection,
      payer,
      USDC,
      getAssociatedTokenAddressSync(USDC, payer.publicKey),
      payer.publicKey,
      200_000n * 1_000_000n
    );
  });

  describe("#initialize_dao", async function () {
    it("initializes the DAO", async function () {
      dao = await autocratClient.initializeDao(META, 400, 5, 5000, USDC);

      let treasuryPdaBump;
      [daoTreasury, treasuryPdaBump] = PublicKey.findProgramAddressSync(
        [dao.toBuffer()],
        autocrat.programId
      );

      const storedDao = await autocratClient.getDao(dao);
      assert(storedDao.treasury.equals(daoTreasury));
      assert.equal(storedDao.treasuryPdaBump, treasuryPdaBump);
      assert(storedDao.tokenMint.equals(META));
      assert(storedDao.usdcMint.equals(USDC));
      assert.equal(storedDao.proposalCount, 0);
      assert.equal(storedDao.passThresholdBps, 300);

      treasuryMetaAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        META,
        daoTreasury
      );
      treasuryUsdcAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        USDC,
        daoTreasury
      );
    });

    it("initializes a second DAO", async function () {
      mertdDao = await autocratClient.initializeDao(
        MERTD,
        0.001,
        1_000_000,
        5_000,
        USDC
      );

      [mertdDaoTreasury] = PublicKey.findProgramAddressSync(
        [mertdDao.toBuffer()],
        autocrat.programId
      );

      mertdTreasuryMertdAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        MERTD,
        mertdDaoTreasury
      );
      mertdTreasuryUsdcAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        USDC,
        mertdDaoTreasury
      );
    });
  });

  describe("#initialize_proposal", async function () {
    it("initializes proposals", async function () {
      const accounts = [
        {
          pubkey: dao,
          isSigner: true,
          isWritable: true,
        },
      ];
      const data = autocrat.coder.instruction.encode("update_dao", {
        daoParams: {
          passThresholdBps: 500,
          baseBurnLamports: null,
          burnDecayPerSlotLamports: null,
          slotsPerProposal: null,
          marketTakerFee: null,
          // minQuoteFutarchicLiquidity: new BN(10),
          // minBaseFutarchicLiquidity: new BN(100),
        },
      });
      const instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      const preMetaBalance = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(META, payer.publicKey)
        )
      ).amount;
      const preUsdcBalance = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(USDC, payer.publicKey)
        )
      ).amount;

      await autocratClient.initializeProposal(
        dao,
        "",
        instruction,
        PriceMath.getChainAmount(5, 9),
        PriceMath.getChainAmount(5000, 6)
      );

      const postMetaBalance = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(META, payer.publicKey)
        )
      ).amount;
      const postUsdcBalance = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(USDC, payer.publicKey)
        )
      ).amount;

      assert.equal(postMetaBalance, preMetaBalance - BigInt(5 * 10 ** 9));
      assert.equal(postUsdcBalance, preUsdcBalance - BigInt(5000 * 10 ** 6));
    });
  });

  describe("#finalize_proposal", async function () {
    let proposal: PublicKey;

    beforeEach(async function () {
      await mintTo(provider.connection, payer, META, treasuryMetaAccount, payer.publicKey, 1_000_000_000n);
      await mintTo(provider.connection, payer, USDC, treasuryUsdcAccount, payer.publicKey, 1_000_000n);

      let receiver = Keypair.generate();
      let to0 = await createAccount(
        provider.connection,
        payer,
        META,
        receiver.publicKey
      );
      let to1 = await createAccount(
        provider.connection,
        payer,
        USDC,
        receiver.publicKey
      );

      const ix = await new Program({
        "version": "0.1.0",
        "name": "autocrat_migrator",
        "instructions": [
          {
            "name": "multiTransfer2",
            "accounts": [
              {
                "name": "tokenProgram",
                "isMut": false,
                "isSigner": false
              },
              {
                "name": "authority",
                "isMut": true,
                "isSigner": true
              },
              {
                "name": "from0",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "to0",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "from1",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "to1",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "systemProgram",
                "isMut": false,
                "isSigner": false
              },
              {
                "name": "lamportReceiver",
                "isMut": true,
                "isSigner": false
              }
            ],
            "args": []
          },
          {
            "name": "multiTransfer4",
            "accounts": [
              {
                "name": "tokenProgram",
                "isMut": false,
                "isSigner": false
              },
              {
                "name": "authority",
                "isMut": true,
                "isSigner": true
              },
              {
                "name": "from0",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "to0",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "from1",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "to1",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "from2",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "to2",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "from3",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "to3",
                "isMut": true,
                "isSigner": false
              },
              {
                "name": "systemProgram",
                "isMut": false,
                "isSigner": false
              },
              {
                "name": "lamportReceiver",
                "isMut": true,
                "isSigner": false
              }
            ],
            "args": []
          }
        ],
        "metadata": {
          "address": "6mTKaBzLAxDeZYPUGJiKB1Njbbx8cNoGjs9mNUTaA3FN"
        }
      } as anchor.Idl, new PublicKey("MigRDW6uxyNMDBD8fX2njCRyJC4YZk2Rx9pDUZiAESt"), provider).methods
        .multiTransfer2()
        .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 138666
        })
      ]).accounts({
          authority: daoTreasury,
          from0: treasuryMetaAccount,
          to0,
          from1: treasuryUsdcAccount,
          to1,
          lamportReceiver: receiver.publicKey,
        })
        .instruction();

      let instruction = {
        programId: ix.programId,
        accounts: ix.keys,
        data: ix.data,
      };

      proposal = await autocratClient.initializeProposal(
        dao,
        "",
        instruction,
        ONE_META.muln(10),
        ONE_USDC.muln(5000)
      );

      let { baseVault, quoteVault } = autocratClient.getProposalPdas(
        proposal,
        META,
        USDC,
        dao
      );
      await vaultClient.mintConditionalTokens(baseVault, 10);
      await vaultClient.mintConditionalTokens(quoteVault, 10_000);
    });

    it("doesn't finalize proposals that are too young", async function () {
      const callbacks = expectError(
        "ProposalTooYoung",
        "finalize succeeded despite proposal being too young"
      );

      await autocratClient
        .finalizeProposal(proposal)
        .then(callbacks[0], callbacks[1]);
    });

    it("finalizes proposals when pass price TWAP > (fail price TWAP + threshold)", async function () {
      let {
        passAmm,
        failAmm,
        passBaseMint,
        passQuoteMint,
        failBaseMint,
        failQuoteMint,
        baseVault,
        quoteVault,
        passLp,
        failLp,
      } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

      // swap $500 in the pass market, make it pass
      await ammClient
        .swapIx(
          passAmm,
          passBaseMint,
          passQuoteMint,
          { buy: {} },
          new BN(500).muln(1_000_000),
          new BN(0)
        )
        .rpc();

      const prePassLpBalance = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(passLp, payer.publicKey)
        )
      ).amount;
      const preFailLpBalance = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(failLp, payer.publicKey)
        )
      ).amount;

      await autocratClient.finalizeProposal(proposal);

      const postPassLpBalance = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(passLp, payer.publicKey)
        )
      ).amount;
      const postFailLpBalance = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(failLp, payer.publicKey)
        )
      ).amount;

      assert(postPassLpBalance > prePassLpBalance);
      assert(postFailLpBalance > preFailLpBalance);

      let storedPassAmm = await ammClient.getAmm(passAmm);
      let storedFailAmm = await ammClient.getAmm(failAmm);


      let passTwap = ammClient.getTwap(storedPassAmm);

      let failTwap = ammClient.getTwap(storedFailAmm);

      console.log(PriceMath.getHumanPrice(passTwap, 9, 6));
      console.log(PriceMath.getHumanPrice(failTwap, 9, 6));

      let storedBaseVault = await vaultClient.getVault(baseVault);
      let storedQuoteVault = await vaultClient.getVault(quoteVault);

      assert.exists(storedBaseVault.status.finalized);
      assert.exists(storedQuoteVault.status.finalized);
    });

    it("rejects proposals when pass price TWAP < fail price TWAP", async function () {
      let {
        passAmm,
        failAmm,
        failBaseMint,
        failQuoteMint,
        baseVault,
        quoteVault,
      } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

      // swap $500 in the fail market, make it fail
      await ammClient
        .swapIx(
          failAmm,
          failBaseMint,
          failQuoteMint,
          { buy: {} },
          new BN(500).muln(1_000_000),
          new BN(0)
        )
        .rpc();


      await autocratClient.finalizeProposal(proposal);

      let storedPassAmm = await ammClient.getAmm(passAmm);
      let storedFailAmm = await ammClient.getAmm(failAmm);


      let passTwap = ammClient.getTwap(storedPassAmm);

      let failTwap = ammClient.getTwap(storedFailAmm);

      console.log(PriceMath.getHumanPrice(passTwap, 9, 6));
      console.log(PriceMath.getHumanPrice(failTwap, 9, 6));

      let storedBaseVault = await vaultClient.getVault(baseVault);
      let storedQuoteVault = await vaultClient.getVault(quoteVault);

      assert.exists(storedBaseVault.status.reverted);
      assert.exists(storedQuoteVault.status.reverted);
    });
  });

  describe("#execute_proposal", async function () {
    let proposal, passAmm, failAmm, baseVault, quoteVault, instruction;

    beforeEach(async function () {
      await mintTo(provider.connection, payer, META, treasuryMetaAccount, payer.publicKey, 1_000_000_000n);
      await mintTo(provider.connection, payer, USDC, treasuryUsdcAccount, payer.publicKey, 1_000_000n);

      const accounts = [
        {
          pubkey: dao,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: daoTreasury,
          isSigner: true,
          isWritable: false,
        },
      ];

      const data = autocrat.coder.instruction.encode("update_dao", {
        daoParams: {
          passThresholdBps: 500,
          slotsPerProposal: new BN(10),
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: new BN(10),
          minBaseFutarchicLiquidity: new BN(100),
        },
      });
      const instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      proposal = await autocratClient.initializeProposal(
        dao,
        "",
        instruction,
        ONE_META.muln(10),
        ONE_USDC.muln(6_000)
      );
      ({ baseVault, quoteVault, passAmm, failAmm } =
        await autocrat.account.proposal.fetch(proposal));

      await vaultClient.mintConditionalTokens(baseVault, 10);
      await vaultClient.mintConditionalTokens(quoteVault, 10_000);
    });

    it("doesn't allow pending proposals to be executed", async function () {
      const callbacks = expectError(
        "ProposalNotPassed",
        "executed despite proposal still pending"
      );

      await autocratClient
        .executeProposal(proposal)
        .then(callbacks[0], callbacks[1]);
    });

    it("doesn't allow failed proposals to be executed", async function () {

      await autocratClient.finalizeProposal(proposal);

      assert.exists(
        (await autocrat.account.proposal.fetch(proposal)).state.failed
      );

      const callbacks = expectError(
        "ProposalNotPassed",
        "executed despite proposal proposal failed"
      );

      await autocratClient
        .executeProposal(proposal)
        .then(callbacks[0], callbacks[1]);
    });

    it("doesn't allow proposals to be executed twice", async function () {
      let {
        passAmm,
        failAmm,
        passBaseMint,
        passQuoteMint,
        failBaseMint,
        failQuoteMint,
        baseVault,
        quoteVault,
      } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

      // swap $500 in the pass market, make it pass
      await ammClient
        .swapIx(
          passAmm,
          passBaseMint,
          passQuoteMint,
          { buy: {} },
          new BN(1000).muln(1_000_000),
          new BN(0)
        )
        .rpc();


      await autocratClient.finalizeProposal(proposal);

      const storedProposal = await autocrat.account.proposal.fetch(proposal);
      assert.exists(storedProposal.state.passed);

      const beforeDao = await autocratClient.getDao(dao);
      assert.equal(beforeDao.passThresholdBps, 300);

      await autocratClient.executeProposal(proposal);

      let afterDao = await autocratClient.getDao(dao);
      assert.equal(afterDao.passThresholdBps, 500);
      assert.ok(afterDao.slotsPerProposal.eqn(10));
      assert.equal(afterDao.minQuoteFutarchicLiquidity.toString(), "10");
      assert.equal(afterDao.minBaseFutarchicLiquidity.toString(), "100");

      const callbacks = expectError(
        "ProposalNotPassed",
        "executed despite already being executed"
      );

      await autocratClient
        .executeProposalIx(proposal, dao, storedProposal.instruction)
        .preInstructions([
          // add a pre-instruction so it doesn't think it's already processed it
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000,
          }),
        ])
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });
  });
});

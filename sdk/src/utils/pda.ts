import BN from "bn.js";

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import { MPL_TOKEN_METADATA_PROGRAM_ID } from "../constants";

export const getVaultAddr = (
  programId: PublicKey,
  settlementAuthority: PublicKey,
  underlyingTokenMint: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("conditional_vault"),
      settlementAuthority.toBuffer(),
      underlyingTokenMint.toBuffer(),
    ],
    programId
  );
};

export const getVaultFinalizeMintAddr = (
  programId: PublicKey,
  vault: PublicKey
) => {
  return getVaultMintAddr(programId, vault, "conditional_on_finalize_mint");
};

export const getMetadataAddr = (mint: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
};

export const getVaultRevertMintAddr = (
  programId: PublicKey,
  vault: PublicKey
) => {
  return getVaultMintAddr(programId, vault, "conditional_on_revert_mint");
};

const getVaultMintAddr = (
  programId: PublicKey,
  vault: PublicKey,
  seed: string
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seed), vault.toBuffer()],
    programId
  );
};

export const getDaoTreasuryAddr = (
  programId: PublicKey,
  dao: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync([dao.toBuffer()], programId);
};

export const getProposalAddr = (
  programId: PublicKey,
  proposer: PublicKey,
  nonce: BN
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("proposal"),
      proposer.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
};

export const getAmmAddr = (
  programId: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("amm__"),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
    ],
    new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
  );
};

export const getAmmLpMintAddr = (
  programId: PublicKey,
  amm: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("amm_lp_mint"), amm.toBuffer()],
    programId
  );
};

import { Autocrat } from "./autocrat";
export { Autocrat, Autocrat as AutocratIDL } from "./autocrat";

import { Amm } from "./amm";
export { Amm, Amm as AmmIDL } from "./amm";

import { ConditionalVault } from "./conditional_vault";
export {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./conditional_vault";

export { LowercaseKeys } from "./utils";

import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export type InitializeDaoParams = any;
export type UpdateDaoParams = any;
export type ProposalInstruction = any;

export type Proposal = IdlAccounts<Autocrat>["proposal"];
export type ProposalWrapper = {
  account: Proposal;
  publicKey: PublicKey;
};

export type DaoAccount = IdlAccounts<Autocrat>["dao"];
export type ProposalAccount = IdlAccounts<Autocrat>["proposal"];

export type AmmAccount = IdlAccounts<Amm>["amm"];

export type ConditionalVaultAccount = IdlAccounts<any>["conditionalVault"];

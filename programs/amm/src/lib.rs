use anchor_lang::prelude::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "amm",
    project_url: "https://metadao.fi",
    contacts: "email:metaproph3t@protonmail.com",
    policy: "The market will decide whether we pay a bug bounty.",
    source_code: "https://github.com/metaDAOproject/futarchy",
    source_release: "v0.3",
    auditors: "Neodyme",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

pub mod error;
pub mod instructions;
pub mod state;

use crate::instructions::*;
use crate::state::*;

declare_id!("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH");

#[program]
pub mod amm {

    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn create_amm(ctx: Context<CreateAmm>, pof: String, uri: String, proposal_number: u16, symbol: String, a: u8) -> Result<()> {
        CreateAmm::handle(ctx, pof, uri, proposal_number, symbol, a)
    }

    pub fn swap(ctx: Context<Swap>, args: SwapArgs) -> Result<()> {
        Swap::handle(ctx, args)
    }
}

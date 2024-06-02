use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::*;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
    Metadata
};
use crate::error::AmmError;
use crate::state::*;

#[derive(Accounts)]
pub struct CreateAmm<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + 144,
        seeds = [
            AMM_SEED_PREFIX,
            base_mint.key().as_ref(),
            quote_mint.key().as_ref()
        ],
        bump
    )]
    pub amm: AccountLoader<'info, Amm>,
    #[account(mut,
    mint::authority = amm,
    mint::freeze_authority = amm,
    mint::decimals = 6,
    )]
    pub base_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::authority = amm,
        associated_token::mint = base_mint
    )]
    pub vault_ata_base: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::authority = amm,
        associated_token::mint = quote_mint
    )]
    pub vault_ata_quote: Box<Account<'info, TokenAccount>>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    /// CHECK: verified via cpi into token metadata
    #[account(mut)]
    pub base_token_metadata: AccountInfo<'info>,
    pub metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

impl CreateAmm<'_> {
    pub fn validate(&self) -> Result<()> {
        require_neq!(
            self.base_mint.key(),
            self.quote_mint.key(),
            AmmError::SameTokenMints
        );

        require_eq!(self.base_mint.supply, 0, AmmError::InvalidSupply);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, pof: String, uri: String, proposal_number: u16, osymbol: String, _: u8) -> Result<()> {
        let CreateAmm {
            user,
            amm: _,
            base_mint,
            quote_mint,
            base_token_metadata,
            ..
        } = ctx.accounts;
        let current_slot = Clock::get()?.slot;

        // there are null bytes we must trim from string, otherwise string value is longer than we want
        let quote_token_symbol_raw = osymbol.clone();
        let quote_token_symbol = quote_token_symbol_raw.trim_matches(char::from(0));

        let base_symbol = format!("{}{}", pof, quote_token_symbol);
       

        let signer_seeds: &[&[u8]; 4] = &[
            AMM_SEED_PREFIX,
            base_mint.to_account_info().key.as_ref(),
            quote_mint.to_account_info().key.as_ref(),
            &[ctx.bumps.amm],
        ];
            
            let cpi_program = ctx.accounts.metadata_program.to_account_info();

            let cpi_accounts = CreateMetadataAccountsV3 {
                metadata: base_token_metadata.to_account_info(),
                mint: base_mint.to_account_info(),
                mint_authority: ctx.accounts.amm.to_account_info(),
                payer: user.to_account_info(),
                update_authority: ctx.accounts.amm.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            };

            create_metadata_accounts_v3(
                CpiContext::new_with_signer(cpi_program, cpi_accounts, &[signer_seeds]),
                DataV2 {
                    name: format!("Proposal {}: {}", proposal_number, base_symbol),
                    symbol: base_symbol,
                    uri: uri.to_string(),
                    seller_fee_basis_points: 0,
                    creators: None,
                    collection: None,
                    uses: None,
                },
                false,
                true,
                None,
            )?;
        
        let amm = &mut ctx.accounts.amm.load_init()?;

        amm.bump = ctx.bumps.amm;

        amm.created_at_slot = current_slot;

        amm.base_mint = base_mint.key();
        amm.quote_mint = quote_mint.key();

        amm.base_mint_decimals = base_mint.decimals;
        amm.quote_mint_decimals = quote_mint.decimals;

        amm.v_base_reserves = (1_000_000_000_u128 * 10_u128.pow(base_mint.decimals as u32)) as u64;
        amm.v_quote_reserves = (10_u128 * 10_u128.pow(quote_mint.decimals as u32)) as u64;
      amm.vault_status = 0;

        Ok(())
    }
}


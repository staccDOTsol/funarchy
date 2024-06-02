use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, *};
use anchor_spl::token_2022::Token2022;
use raydium_cp_swap::cpi::accounts::Initialize;
use raydium_cp_swap::program::RaydiumCpSwap;
use crate::{AMM_SEED_PREFIX};
use crate::error::AmmError;
use crate::{Amm, SwapType};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SwapArgs {
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub output_amount_min: u64,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub amm: AccountLoader<'info, Amm>,
    #[account(
        mut,
        token::mint = amm.load()?.base_mint,
        token::authority = user,
    )]
    pub user_base_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = amm.load()?.quote_mint,
        token::authority = user,
    )]
    pub user_quote_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = amm.load()?.base_mint,
        associated_token::authority = amm,
    )]
    pub vault_ata_base: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = amm.load()?.quote_mint,
        associated_token::authority = amm,
    )]
    pub vault_ata_quote: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub token_2022_program: Program<'info, Token2022>,
    #[account(
        mut,
        constraint = base_mint.key() == amm.load()?.base_mint,
    )]
    pub base_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = quote_mint.key() == amm.load()?.quote_mint,
    )]
    pub quote_mint: Box<Account<'info, Mint>>,
    pub raydium_cp_swap_program: Program<'info, RaydiumCpSwap>,
    ///  CHECK: verified via cpi into token ray
    pub amm_config: AccountInfo<'info>,
    /// CHECK: verified via cpi into token ray
    pub authority: AccountInfo<'info>,
    /// CHECK: verified via cpi into token ray
    #[account(mut)]
    pub pool_account: AccountInfo<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    /// CHECK: verified via cpi into token ray
    #[account(mut)]
    pub token_0_vault: AccountInfo<'info>,
    /// CHECK: verified via cpi into token ray
    #[account(mut)]
    pub token_1_vault: AccountInfo<'info>,
    /// CHECK: verified via cpi into token ray
    #[account(mut)]
    pub create_lp_account: AccountInfo<'info>,
    /// CHECK: verified via cpi into token ray
    #[account(mut)]
    pub create_pool_fee: AccountInfo<'info>,
    /// CHECK: verified via cpi into token ray
    #[account(mut)]
    pub observation_key: AccountInfo<'info>,
    /// CHECK: verified via cpi into token ray
    #[account(mut)]
    pub lp_mint: AccountInfo<'info>,

}

impl Swap<'_> {
    pub fn handle(ctx: Context<Swap>, args: SwapArgs) -> Result<()> {
        let accounts = ctx.accounts;
        let SwapArgs {
            swap_type,
            input_amount,
            output_amount_min,
        } = args;

        match swap_type {
            SwapType::Buy => require_gte!(
                accounts.user_quote_account.amount,
                input_amount,
                AmmError::InsufficientBalance
            ),
            SwapType::Sell => require_gte!( 
                accounts.user_base_account.amount,
                input_amount,
                AmmError::InsufficientBalance
            ),
        };

        require!(input_amount > 0, AmmError::ZeroSwapAmount);

        let signer_seeds = {
            &[
                AMM_SEED_PREFIX,
                accounts.base_mint.to_account_info().key.as_ref(),
                accounts.quote_mint.to_account_info().key.as_ref(),
                &[accounts.amm.load()?.bump],
            ]
        };
        let output_amount = {
            accounts.amm.load_mut()?.swap(input_amount, swap_type)?
        };
        let (user_from, vault_to, vault_from, user_to) = match swap_type {
            SwapType::Buy => (
                accounts.user_quote_account.clone(),
                accounts.vault_ata_quote.clone(),
                accounts.vault_ata_base.clone(),
                accounts.user_base_account.clone(),
            ),
            SwapType::Sell => (
                accounts.user_base_account.clone(),
                accounts.vault_ata_base.clone(),
                accounts.vault_ata_quote.clone(),
                accounts.user_quote_account.clone(),
            ),
        };
        {
        match swap_type {
            SwapType::Buy => 
            {
                
                if accounts.amm.load()?.v_base_reserves as i64 -  output_amount as i64 <= 0 {
                  { 
                    let amm = &mut accounts.amm.load_mut()?;
                    amm.v_base_reserves = (1_000_000_000_u128 * 10_u128.pow(accounts.base_mint.decimals as u32)) as u64;
                    amm.v_quote_reserves = (10_u128 * 10_u128.pow(accounts.quote_mint.decimals as u32)) as u64;
                  
                  }
                    let mint0 = accounts.base_mint.clone().key();
                    let mint1 = accounts.quote_mint.key();
                    let init_amount_0 = accounts.vault_ata_base.amount;
                    let init_amount_1 = accounts.vault_ata_quote.amount;
                    let (mint0, mint1, init_amount_0, init_amount_1, user_token_0_account, user_token_1_account, token_0_program, token_1_program) = if mint0 > mint1 {
                        let token_0_program = if accounts.quote_mint.to_account_info().owner == &accounts.token_program.key() {
                            accounts.token_program.to_account_info()
                        } else {
                            accounts.token_2022_program.to_account_info()
                        };
                        let token_1_program = if accounts.base_mint.clone().to_account_info().owner == &accounts.token_program.key() {
                            accounts.token_program.to_account_info()
                        } else {
                            accounts.token_2022_program.to_account_info()
                        };
                        (accounts.quote_mint.clone(), accounts.base_mint.clone(), init_amount_1, init_amount_0, accounts.user_quote_account.clone(), accounts.user_base_account.clone(), token_0_program, token_1_program)
                    } else {
                        let token_0_program = if accounts.base_mint.clone().to_account_info().owner == &accounts.token_program.key() {
                            accounts.token_program.to_account_info()
                        } else {
                            accounts.token_2022_program.to_account_info()
                        };
                        let token_1_program = if accounts.quote_mint.to_account_info().owner == &accounts.token_program.key() {
                            accounts.token_program.to_account_info()
                        } else {
                            accounts.token_2022_program.to_account_info()
                        };
                        (accounts.base_mint.clone(), accounts.quote_mint.clone(), init_amount_0, init_amount_1, accounts.user_base_account.clone(), accounts.user_quote_account.clone(), token_0_program, token_1_program)
                    };
                    raydium_cp_swap::cpi::initialize(
                        CpiContext::new(
                            accounts.raydium_cp_swap_program.to_account_info(),
                            Initialize {
                                creator: accounts.user.to_account_info(),
                                token_program: accounts.token_program.to_account_info(),
                                amm_config: accounts.amm_config.to_account_info(),

                                authority: accounts.authority.to_account_info(),
                                pool_state: accounts.pool_account.to_account_info(),
                                token_0_mint: mint0.to_account_info(),
                                token_1_mint: mint1.to_account_info(),
                                lp_mint: accounts.lp_mint.to_account_info(),
                                creator_token_0: user_token_0_account.to_account_info(),
                                creator_token_1: user_token_1_account.to_account_info(),
                                creator_lp_token: accounts.create_lp_account.to_account_info(),
                                token_0_vault: accounts.token_0_vault.to_account_info(),
                                token_1_vault: accounts.token_1_vault.to_account_info(),
                                create_pool_fee: accounts.create_pool_fee.to_account_info(),
                                observation_state: accounts.observation_key.to_account_info(),
                                token_0_program: token_0_program,
                                token_1_program: token_1_program,
                                associated_token_program: accounts.associated_token_program.to_account_info(),
                                system_program: accounts.system_program.to_account_info(),
                                rent: accounts.rent.to_account_info()
                            },                
                        ),
                            init_amount_0,
                            init_amount_1,
                            0,
                        

                    ).unwrap();
                }

                token::transfer(
                    CpiContext::new(
                        accounts.token_program.to_account_info(),
                        Transfer {
                            from: user_from.to_account_info(),
                            to: vault_to.to_account_info(),
                            authority: accounts.user.to_account_info(),
                        },
                    ),
                    input_amount,
                )?;

                token::mint_to(
                    CpiContext::new_with_signer(
                        accounts.token_program.to_account_info(),
                        MintTo {
                            to: user_to.to_account_info(),
                            mint: accounts.base_mint.to_account_info(),
                            authority: accounts.amm.to_account_info(),
                        },
                        &[signer_seeds]
                    ),
                    output_amount,
                )?;

            }
            SwapType::Sell => {
                {
                token::transfer(
                    CpiContext::new_with_signer(
                        accounts.token_program.to_account_info(),
                        Transfer {
                            from: vault_from.to_account_info(),
                            to: user_to.to_account_info(),
                            authority: accounts.amm.to_account_info(),
                        },
                        &[signer_seeds]
                                   ),
                    output_amount,
                )?;

                token::burn(
                    CpiContext::new(
                        accounts.token_program.to_account_info(),
                        Burn {
                            from: user_from.to_account_info(),
                            mint: accounts.base_mint.to_account_info(),
                            authority: accounts.user.to_account_info(),
                        },
                        
                        
                    ),
                    input_amount,
                )?;


            }
        };
    }

        require_gte!(
            output_amount,
            output_amount_min,
            AmmError::SwapSlippageExceeded
        );

        Ok(())
    }
}


use anchor_lang::prelude::*;

use crate::error::AmmError;

#[derive(Clone, Copy, Debug, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum SwapType {
    /// Swap quote tokens into base tokens
    Buy,
    /// Swap base tokens into quote tokens
    Sell,
}

#[account(zero_copy(unsafe))]
pub struct Amm {
    pub bump: u8,

    pub created_at_slot: u64,

    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,

    pub base_mint_decimals: u8,
    pub quote_mint_decimals: u8,

    pub v_quote_reserves: u64,
    pub v_base_reserves: u64,

    pub vault_status: u8,
}

impl Amm {
    pub fn buy_quote(&self, amount: u128) -> u64 {
       
        let v_quote_reserves = self.v_quote_reserves as u128;
        let v_base_reserves = self.v_base_reserves as u128;
        let cost: u64 =
            ((amount * v_quote_reserves) / (v_base_reserves - amount)) as u64;

        return cost + 1; // always round up
    }

    pub fn sell_quote(&self, amount: u128) -> u64 {
        let v_quote_reserves = self.v_quote_reserves as u128;
        let v_base_reserves = self.v_base_reserves as u128;
        let output: u64 =
            ((amount * v_base_reserves) / (v_quote_reserves + amount)) as u64; // Corrected formula to use base reserves in numerator

        return output;
    }

    pub fn calculate_price(&self) -> Result<u128> {
        let v_quote_reserves = self.v_quote_reserves as u128;
        let v_base_reserves = self.v_base_reserves as u128;
        let price = (v_quote_reserves * 100) / v_base_reserves;
        Ok(price)
    }

    pub fn k(&self) -> u128 {
        self.v_base_reserves as u128 * self.v_quote_reserves as u128
    }

    /// Does the internal accounting to swap `input_amount` into the returned
    /// output amount so that output amount can be transferred to the user.
    pub fn swap(&mut self, input_amount: u64, swap_type: SwapType) -> Result<u64> {
        let base_amount_start = self.v_base_reserves as u128;
        let quote_amount_start = self.v_quote_reserves as u128;

        let k = self.k();

        let (input_reserve, output_reserve) = match swap_type {
            SwapType::Buy => (quote_amount_start, base_amount_start),
            SwapType::Sell => (base_amount_start, quote_amount_start),
        };

        let input_amount_with_fee = match swap_type {
            SwapType::Buy => self.buy_quote(input_amount as u128) * 99,
            SwapType::Sell => self.sell_quote(input_amount as u128) * 99,
        } as u128;

        let numerator = input_amount_with_fee
            .checked_mul(output_reserve)
            .ok_or(error!(AmmError::InputAmountOverflow))?;

        let denominator = (input_reserve * 100) + input_amount_with_fee;

        let output_amount = (numerator / denominator)
            .try_into()
            .map_err(|_| AmmError::CastingOverflow)?;

        let new_k = self.k();
        match self.vault_status {
            1 => {
                if swap_type == SwapType::Buy {
                    return Err(AmmError::BuyDisabled.into());
                } else if swap_type == SwapType::Sell {
                    // Boost the output amount by 10%
                    let boosted_output_amount = (output_amount as f64 * 1.10) as u64;
                    self.v_base_reserves += input_amount;
                    self.v_quote_reserves -= boosted_output_amount;
                }
            }
            2 => {
                if swap_type == SwapType::Buy {
                    return Err(AmmError::BuyDisabled.into());
                } else if swap_type == SwapType::Sell {
                    // Decrease the output amount inversely by 10%
                    let decreased_output_amount = (output_amount as f64 * 0.90) as u64;
                    self.v_base_reserves += input_amount;
                    self.v_quote_reserves -= decreased_output_amount;
                }
            }
            _ => {
                match swap_type {
                    SwapType::Buy => {
                        self.v_quote_reserves += input_amount;
                        self.v_base_reserves -= output_amount;
                    }
                    SwapType::Sell => {
                        self.v_base_reserves += input_amount;
                        self.v_quote_reserves -= output_amount;
                    }
                }
            }
        }

    msg!("Input Amount: {}", input_amount);
    msg!("Input Amount with Fee: {}", input_amount_with_fee);
    msg!("Numerator: {}", numerator);
    msg!("Denominator: {}", denominator);
    msg!("Output Amount: {}", output_amount);
        require_gte!(new_k, k, AmmError::ConstantProductInvariantFailed);

        Ok(output_amount)
    }
}

#[macro_export]
macro_rules! generate_amm_seeds {
    ($amm:expr) => {{
        &[
            AMM_SEED_PREFIX,
            $amm.base_mint.as_ref(),
            $amm.quote_mint.as_ref(),
            &[$amm.bump],
        ]
    }};
}

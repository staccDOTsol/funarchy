
use super::*;

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    #[account(mut,

        has_one = pass_amm,
        has_one = fail_amm,
        has_one = dao,
    )]
    pub proposal: Account<'info, Proposal>,
    pub pass_amm: Account<'info, Amm>,
    pub fail_amm: Account<'info, Amm>,
    #[account(has_one = treasury)]
    pub dao: Box<Account<'info, Dao>>,
    /// CHECK: never read
    pub treasury: UncheckedAccount<'info>,
}

impl FinalizeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            clock.slot >= self.proposal.slot_enqueued + self.dao.slots_per_proposal,
            AutocratError::ProposalTooYoung
        );

        require!(
            self.proposal.state == ProposalState::Pending,
            AutocratError::ProposalAlreadyFinalized
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let FinalizeProposal {
            proposal,
            pass_amm,
            fail_amm,
            dao,
            ..

        } = ctx.accounts;

        let pass_market_twap = pass_amm.calculate_price()?;
        let fail_market_twap = fail_amm.calculate_price()?;

        // this can't overflow because each twap can only be MAX_PRICE (~1e31),
        // MAX_BPS + pass_threshold_bps is at most 1e5, and a u128 can hold
        // 1e38. still, saturate
        let threshold = fail_market_twap
            .saturating_mul(MAX_BPS.saturating_add(dao.pass_threshold_bps).into())
            / MAX_BPS as u128;

        let new_proposal_state = if pass_market_twap > threshold {
            pass_amm.vault_status = 1;
            fail_amm.vault_status = 2;
            ProposalState::Passed
        } else {
            pass_amm.vault_status = 2;
            fail_amm.vault_status = 1;
            ProposalState::Failed
        };

        proposal.state = new_proposal_state;

        match new_proposal_state {
            ProposalState::Passed => {
                assert!(pass_amm.vault_status == 1);
                assert!(fail_amm.vault_status == 2);
            }
            ProposalState::Failed => {
                assert!(pass_amm.vault_status == 2);
                assert!(fail_amm.vault_status == 1);
            }
            _ => unreachable!("Encountered an unexpected proposal state"),
        }

        Ok(())
    }
}

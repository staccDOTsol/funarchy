use super::*;

use amm::state::ONE_MINUTE_IN_SLOTS;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProposalParams {
    pub description_url: String,
    pub instruction: ProposalInstruction,
    pub pass_lp_tokens_to_lock: u64,
    pub fail_lp_tokens_to_lock: u64,
    pub nonce: u64,
}

#[derive(Accounts)]
#[instruction(args: InitializeProposalParams)]
pub struct InitializeProposal<'info> {
    #[account(
        init,
        payer = proposer,
        space = 2000,
        seeds = [b"proposal", proposer.key().as_ref(), &args.nonce.to_le_bytes()],
        bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(
        constraint = fail_amm.quote_mint == dao.token_mint,
    )]
    pub fail_amm: Account<'info, Amm>,
    #[account(
        constraint = pass_amm.quote_mint == dao.token_mint,
    )]
    pub pass_amm: Account<'info, Amm>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitializeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        for amm in [&self.pass_amm, &self.fail_amm] {
            // an attacker is able to crank 5 observations before a proposal starts
            require!(
                clock.slot < amm.created_at_slot + (50 * ONE_MINUTE_IN_SLOTS),
                AutocratError::AmmTooOld
            );
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: InitializeProposalParams) -> Result<()> {
        let Self {
            proposal,
            dao,
            pass_amm,
            fail_amm,
            proposer,
            system_program: _,
        } = ctx.accounts;

        let InitializeProposalParams {
            description_url,
            instruction,
            pass_lp_tokens_to_lock,
            fail_lp_tokens_to_lock,
            nonce,
        } = params;

        let clock = Clock::get()?;

        dao.proposal_count += 1;

        proposal.set_inner(Proposal {
            number: dao.proposal_count,
            proposer: proposer.key(),
            description_url,
            slot_enqueued: clock.slot,
            state: ProposalState::Pending,
            instruction,
            pass_amm: pass_amm.key(),
            fail_amm: fail_amm.key(),
            dao: dao.key(),
            pass_lp_tokens_locked: pass_lp_tokens_to_lock,
            fail_lp_tokens_locked: fail_lp_tokens_to_lock,
            nonce,
            pda_bump: ctx.bumps.proposal,
        });

        Ok(())
    }
}

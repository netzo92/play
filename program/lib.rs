use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;

declare_id!("ENvbgE1i87X6uT6vG59P2U1NpkcM3cM7h98v9pP1qN77"); // Placeholder ID

#[program]
pub mod tournament_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, entry_fee: u64) -> Result<()> {
        let tournament = &mut ctx.accounts.tournament;
        tournament.authority = ctx.accounts.authority.key();
        tournament.entry_fee = entry_fee;
        tournament.total_pool = 0;
        tournament.is_active = true;
        Ok(())
    }

    pub fn join_tournament(ctx: Context<Join>) -> Result<()> {
        let tournament = &mut ctx.accounts.tournament;
        
        // Transfer 0.1 SOL from player to the tournament PDA (vault)
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_instruction::transfer(
                &ctx.accounts.player.key(),
                &tournament.key(),
                tournament.entry_fee,
            ),
        );
        anchor_lang::solana_program::program::invoke(
            &cpi_context.instruction,
            &[
                ctx.accounts.player.to_account_info(),
                tournament.to_account_info(),
            ],
        )?;

        tournament.total_pool += tournament.entry_fee;
        Ok(())
    }

    pub fn claim_winner(ctx: Context<Claim>) -> Result<()> {
        let tournament = &mut ctx.accounts.tournament;
        
        // Only the authority can declare a winner (simplification for demo)
        require!(ctx.accounts.authority.key() == tournament.authority, ErrorCode::Unauthorized);
        
        let prize = tournament.total_pool;
        tournament.total_pool = 0;
        tournament.is_active = false;

        // Transfer pool to winner
        **tournament.to_account_info().try_borrow_mut_lamports()? -= prize;
        **ctx.accounts.winner.to_account_info().try_borrow_mut_lamports()? += prize;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 8 + 8 + 1)]
    pub tournament: Account<'info, Tournament>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Join<'info> {
    #[account(mut)]
    pub tournament: Account<'info, Tournament>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, close = authority)]
    pub tournament: Account<'info, Tournament>,
    /// CHECK: This is the winner who receives the funds
    #[account(mut)]
    pub winner: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Tournament {
    pub authority: Pubkey,
    pub entry_fee: u64,
    pub total_pool: u64,
    pub is_active: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
}

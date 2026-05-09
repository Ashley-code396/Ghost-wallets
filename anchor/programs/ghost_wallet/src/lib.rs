use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("wsMSPLq1C2eB9BcjVxuzqfggWCvPVkHu1z81tFma7F3");

#[program]
pub mod ghost_wallet {
    use super::*;

    pub fn create_ghost_wallet(
        ctx: Context<CreateGhostWallet>,
        task_id: u64,
        purpose: String,
        duration_seconds: i64,
    ) -> Result<()> {
        require!(purpose.len() <= 64, GhostWalletError::PurposeTooLong);
        
        let clock = Clock::get()?;
        let expires_at = clock.unix_timestamp.checked_add(duration_seconds).unwrap();

        let wallet = &mut ctx.accounts.wallet;
        wallet.creator = ctx.accounts.creator.key();
        wallet.task_id = task_id;
        wallet.purpose = purpose;
        wallet.created_at = clock.unix_timestamp;
        wallet.expires_at = expires_at;
        wallet.balance = 0;
        wallet.status = 0; // Active
        wallet.bump = ctx.bumps.wallet;
        wallet.action_count = 0;

        Ok(())
    }

    pub fn fund_ghost_wallet(ctx: Context<FundGhostWallet>, amount: u64) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        require!(wallet.status == 0, GhostWalletError::WalletNotActive);
        
        let clock = Clock::get()?;
        require!(clock.unix_timestamp <= wallet.expires_at, GhostWalletError::WalletExpired);

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.funder.to_account_info(),
                    to: wallet.to_account_info(),
                },
            ),
            amount,
        )?;

        wallet.balance = wallet.balance.checked_add(amount).unwrap();
        let current_index = wallet.action_count;
        wallet.action_count = wallet.action_count.checked_add(1).unwrap();

        // Emit GhostAction
        let action = &mut ctx.accounts.action;
        action.wallet = wallet.key();
        action.action_type = 0; // Fund
        action.amount = amount;
        action.timestamp = clock.unix_timestamp;
        action.metadata = "Funded wallet".to_string();

        Ok(())
    }

    pub fn execute_action(ctx: Context<ExecuteAction>, amount: u64, metadata: String) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        require!(wallet.status == 0, GhostWalletError::WalletNotActive);
        
        let clock = Clock::get()?;
        require!(clock.unix_timestamp <= wallet.expires_at, GhostWalletError::WalletExpired);
        require!(wallet.balance >= amount, GhostWalletError::InsufficientFunds);
        require!(wallet.creator == ctx.accounts.creator.key(), GhostWalletError::Unauthorized);
        require!(metadata.len() <= 64, GhostWalletError::MetadataTooLong);

        let bump = wallet.bump;
        let creator_key = wallet.creator;
        let task_id_bytes = wallet.task_id.to_le_bytes();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"ghost",
            creator_key.as_ref(),
            &task_id_bytes,
            &[bump],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: wallet.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        wallet.balance = wallet.balance.checked_sub(amount).unwrap();
        let current_index = wallet.action_count;
        wallet.action_count = wallet.action_count.checked_add(1).unwrap();

        // Emit GhostAction
        let action = &mut ctx.accounts.action;
        action.wallet = wallet.key();
        action.action_type = 1; // Execute
        action.amount = amount;
        action.timestamp = clock.unix_timestamp;
        action.metadata = metadata;

        Ok(())
    }

    pub fn expire_wallet(ctx: Context<ExpireWallet>) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        let clock = Clock::get()?;
        
        require!(clock.unix_timestamp > wallet.expires_at, GhostWalletError::WalletNotYetExpired);
        
        wallet.status = 1; // Expired
        let current_index = wallet.action_count;
        wallet.action_count = wallet.action_count.checked_add(1).unwrap();

        // Emit GhostAction
        let action = &mut ctx.accounts.action;
        action.wallet = wallet.key();
        action.action_type = 2; // Expire
        action.amount = 0;
        action.timestamp = clock.unix_timestamp;
        action.metadata = "Expired wallet".to_string();

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(task_id: u64, purpose: String, duration_seconds: i64)]
pub struct CreateGhostWallet<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + GhostWallet::INIT_SPACE,
        seeds = [b"ghost", creator.key().as_ref(), task_id.to_le_bytes().as_ref()],
        bump
    )]
    pub wallet: Account<'info, GhostWallet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundGhostWallet<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(mut)]
    pub wallet: Account<'info, GhostWallet>,
    #[account(
        init,
        payer = funder,
        space = 8 + GhostAction::INIT_SPACE,
        seeds = [b"action", wallet.key().as_ref(), wallet.action_count.to_le_bytes().as_ref()],
        bump
    )]
    pub action: Account<'info, GhostAction>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteAction<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub wallet: Account<'info, GhostWallet>,
    /// CHECK: Recipient of the executed action
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + GhostAction::INIT_SPACE,
        seeds = [b"action", wallet.key().as_ref(), wallet.action_count.to_le_bytes().as_ref()],
        bump
    )]
    pub action: Account<'info, GhostAction>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExpireWallet<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(mut)]
    pub wallet: Account<'info, GhostWallet>,
    #[account(
        init,
        payer = caller,
        space = 8 + GhostAction::INIT_SPACE,
        seeds = [b"action", wallet.key().as_ref(), wallet.action_count.to_le_bytes().as_ref()],
        bump
    )]
    pub action: Account<'info, GhostAction>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct GhostWallet {
    pub creator: Pubkey,
    pub task_id: u64,
    #[max_len(64)]
    pub purpose: String,
    pub created_at: i64,
    pub expires_at: i64,
    pub balance: u64,
    pub status: u8,
    pub bump: u8,
    pub action_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct GhostAction {
    pub wallet: Pubkey,
    pub action_type: u8,
    pub amount: u64,
    pub timestamp: i64,
    #[max_len(64)]
    pub metadata: String,
}

#[error_code]
pub enum GhostWalletError {
    #[msg("Purpose must be 64 characters or less")]
    PurposeTooLong,
    #[msg("Metadata must be 64 characters or less")]
    MetadataTooLong,
    #[msg("Wallet is not active")]
    WalletNotActive,
    #[msg("Wallet has expired")]
    WalletExpired,
    #[msg("Wallet has not yet expired")]
    WalletNotYetExpired,
    #[msg("Insufficient funds in wallet")]
    InsufficientFunds,
    #[msg("Unauthorized")]
    Unauthorized,
}

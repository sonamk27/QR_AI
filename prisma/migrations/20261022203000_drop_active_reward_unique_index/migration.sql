-- Drop the rogue index that prevented customers from earning multiple unredeemed rewards
DROP INDEX IF EXISTS "idx_one_active_reward_per_customer";

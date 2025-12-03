export type UserProfile = {
  name: string;
  sub: string;
  email: string;
  email_verified: boolean | "true" | "false";
  coin_balance: number;
  territory_blocks: number;
  six_digit_code: string;
  created_at: string;
  last_mined?: string;
  token_balance?: number;
  xp?: number;
};

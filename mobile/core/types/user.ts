export type UserProfile = {
  sub: string;
  name: string;
  email: string;
  email_verified: boolean | "true" | "false";
  coin_balance: number;
  territory_blocks: number;
  six_digit_code: string;
  created_at: string;
};

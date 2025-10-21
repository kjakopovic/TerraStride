import { z } from "zod";

export const verificationCodeSchema = z.object({
  codeDigits: z
    .array(z.string().regex(/^\d$/, "Digit required"))
    .length(6, "Enter the 6-digit code"),
});

export type VerificationCodeValues = z.infer<typeof verificationCodeSchema>;

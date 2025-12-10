import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string({ required_error: "Username is required" })
    .min(3, "Username must be at least 3 characters"),
  email: z
    .string({ required_error: "Email is required" })
    .email("Enter a valid email"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters"),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const verificationCodeSchema = z.object({
  codeDigits: z
    .array(z.string().regex(/^\d$/, "Digit required"))
    .length(6, "Enter the 6-digit code"),
});

export type VerificationCodeValues = z.infer<typeof verificationCodeSchema>;

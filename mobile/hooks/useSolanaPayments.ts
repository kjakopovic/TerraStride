import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMintToInstruction,
  createTransferInstruction,
} from "@solana/spl-token";

export const useSolanaPayments = () => {
  const payAdmission = async () => {
    // Create connection to local validator
    const connection = new Connection("http://localhost:8899", "confirmed");
    const latestBlockhash = await connection.getLatestBlockhash();

    // Generate a new keypair for the fee payer
    const feePayer = Keypair.generate();

    // Generate a new keypair for the recipient
    const recipient = Keypair.generate();

    console.log("Fee Payer Public Key:", feePayer.publicKey.toBase58());
    console.log("Recipient Public Key:", recipient.publicKey.toBase58());
  };
  return { payAdmission };
};

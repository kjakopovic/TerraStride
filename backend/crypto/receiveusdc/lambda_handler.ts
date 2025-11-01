import { Connection, PublicKey } from "@solana/web3.js";
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({});
const connection = new Connection(process.env.SOLANA_RPC!);

export const handler = async (event: any) => {
  const headers = event.headers || {};
  const accessToken = headers["access_token"] || headers["Access_Token"];
  if (!accessToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Missing access_token" }),
    };
  }

  let body: any;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid JSON body" }),
    };
  }

  const { transactionSignature } = body;
  if (!transactionSignature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing transactionSignature" }),
    };
  }

  // Get user info from Cognito
  const getUserResponse = await cognitoClient.send(
    new GetUserCommand({ AccessToken: accessToken })
  );
  const userId = getUserResponse.Username!;
  const solanaWalletAttr = getUserResponse.UserAttributes?.find(
    (attr) => attr.Name === "custom:solana_wallet"
  );
  if (!solanaWalletAttr) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "User has no Solana wallet" }),
    };
  }

  const userPublicKey = new PublicKey(solanaWalletAttr.Value!);

  // Fetch the transaction from Solana
  const tx = await connection.getParsedTransaction(
    transactionSignature,
    "confirmed"
  );
  if (!tx) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Transaction not found" }),
    };
  }

  // Parse transaction to find USDC transfer to user's wallet
  let receivedAmount = 0;
  const usdcMintAddress = process.env.USDC_MINT_ADDRESS!;
  for (const instr of tx.transaction.message.instructions) {
    if ("parsed" in instr && instr.program === "spl-token") {
      const parsed = (instr as any).parsed;
      if (
        parsed.type === "transfer" &&
        parsed.info.destination === userPublicKey.toBase58() &&
        parsed.info.mint === usdcMintAddress
      ) {
        receivedAmount += parseFloat(parsed.info.amount) / 1e6; // USDC has 6 decimals
      }
    }
  }

  if (receivedAmount <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "No USDC received in transaction" }),
    };
  }

  // Update user's coin_balance in Cognito
  const coinBalanceAttr = getUserResponse.UserAttributes?.find(
    (attr) => attr.Name === "custom:coin_balance"
  );
  const previousBalance = coinBalanceAttr
    ? parseFloat(coinBalanceAttr.Value!)
    : 0;
  const newBalance = previousBalance + receivedAmount;

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.USER_POOL_ID!,
      Username: userId,
      UserAttributes: [
        { Name: "custom:coin_balance", Value: newBalance.toString() },
      ],
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ newBalance, receivedAmount }),
  };
};

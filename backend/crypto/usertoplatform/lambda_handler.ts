import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const cognitoClient = new CognitoIdentityProviderClient({});
const secretsClient = new SecretsManagerClient({});
const connection = new Connection(process.env.SOLANA_RPC!);
const USDC_MINT = new PublicKey(process.env.USDC_MINT_ADDRESS!);

export const handler = async (event: any) => {
  const headers = event.headers || {};
  const accessToken = headers["access_token"] || headers["Access_Token"];
  if (!accessToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Missing access_token in headers" }),
    };
  }

  // Parse JSON body
  let body: any;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid JSON body" }),
    };
  }

  const amount = body.amount;
  if (!amount || isNaN(amount) || amount <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid amount provided" }),
    };
  }

  // Get user info from Cognito using access_token
  const getUserResponse = await cognitoClient.send(
    new GetUserCommand({ AccessToken: accessToken })
  );

  // Retrieve user's Solana wallet keys
  const solanaWalletAttr = getUserResponse.UserAttributes?.find(
    (attr) => attr.Name === "custom:solana_wallet"
  );
  const solanaPrivateAttr = getUserResponse.UserAttributes?.find(
    (attr) => attr.Name === "custom:solana_private_key"
  );
  const coinBalanceAttr = getUserResponse.UserAttributes?.find(
    (attr) => attr.Name === "custom:coin_balance"
  );

  if (!solanaWalletAttr || !solanaPrivateAttr) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "User does not have a Solana wallet" }),
    };
  }

  const userId = getUserResponse.Username!;
  const previousBalance = coinBalanceAttr
    ? parseFloat(coinBalanceAttr.Value!)
    : 0;

  if (previousBalance < amount) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Insufficient balance" }),
    };
  }

  const newBalance = previousBalance - amount;

  // Recreate user Keypair from stored private key
  const userSecretKey = Uint8Array.from(
    Buffer.from(solanaPrivateAttr.Value!, "base64")
  );
  const userKeypair = Keypair.fromSecretKey(userSecretKey);

  // Get platform wallet secret from Secrets Manager
  const secret = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: process.env.PLATFORM_WALLET_SECRET_ID!,
    })
  );

  const platformSecretKey = Uint8Array.from(
    Buffer.from(secret.SecretString!, "base64")
  );
  const platformKeypair = Keypair.fromSecretKey(platformSecretKey);

  // Get or create token accounts
  const userATA = await getOrCreateAssociatedTokenAccount(
    connection,
    userKeypair,
    USDC_MINT,
    userKeypair.publicKey
  );

  const platformATA = await getOrCreateAssociatedTokenAccount(
    connection,
    userKeypair,
    USDC_MINT,
    platformKeypair.publicKey
  );

  // Transfer USDC from user to platform
  const txSig = await transfer(
    connection,
    userKeypair,
    userATA.address,
    platformATA.address,
    userKeypair.publicKey,
    amount * 1e6 // USDC decimals
  );

  // Update user balance in Cognito
  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.USER_POOL_ID!,
      Username: userId,
      UserAttributes: [
        {
          Name: "custom:coin_balance",
          Value: newBalance.toString(),
        },
      ],
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ txSig, newBalance }),
  };
};

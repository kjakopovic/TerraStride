import { Keypair } from "@solana/web3.js";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: any) => {
  try {
    const userPoolId = process.env.USER_POOL_ID!;
    const headers = event.headers || {};

    const accessToken = headers["access_token"] || headers["Access_Token"];
    if (!accessToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Missing access_token in headers" }),
      };
    }

    // Get user info from Cognito using access_token
    const getUserResponse = await cognitoClient.send(
      new GetUserCommand({ AccessToken: accessToken })
    );

    const userId = getUserResponse.Username;
    if (!userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found in Cognito" }),
      };
    }

    // Generate Solana wallet
    const keypair = Keypair.generate();

    // Save public key in Cognito custom attribute
    await cognitoClient.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: userId,
        UserAttributes: [
          {
            Name: "custom:solana_wallet",
            Value: keypair.publicKey.toBase58(),
          },
          {
            Name: "custom:solana_private_key",
            Value: Buffer.from(keypair.secretKey).toString("base64"),
          },
        ],
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Wallet created successfully",
        publicKey: keypair.publicKey.toBase58(),
      }),
    };
  } catch (err: any) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: err.message,
      }),
    };
  }
};

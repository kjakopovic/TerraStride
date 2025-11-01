import * as cdk from "aws-cdk-lib";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export class CryptoStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPoolId = this.node.tryGetContext("userPoolId");
    if (!userPoolId) throw new Error("Missing context variable: userPoolId");

    const userPoolArn = `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${userPoolId}`;

    // Create platform wallet secret
    const platformWalletSecret = new secretsmanager.Secret(
      this,
      "PlatformWalletSecret",
      {
        secretName: "platform-wallet-secret-devnet",
        description: "Devnet platform wallet private key",
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            dummy: "replace-with-base58-key",
          }),
          generateStringKey: "key",
        },
      }
    );

    const commonEnv = {
      USER_POOL_ID: userPoolId,
      SOLANA_RPC: "https://api.devnet.solana.com",
      USDC_MINT_ADDRESS: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      PLATFORM_WALLET_SECRET_ID: platformWalletSecret.secretName,
    };

    const lambdas = [
      {
        id: "CreateWalletLambda",
        folder: "createwallet",
        entryFile: "lambda_handler.ts",
        apiPath: ["wallet"],
      },
      {
        id: "ReceiveUSDCForUserLambda",
        folder: "platformtouser",
        entryFile: "lambda_handler.ts",
        apiPath: ["platform", "send"],
      },
      {
        id: "UserPayUSDCToPlatformLambda",
        folder: "usertoplatform",
        entryFile: "lambda_handler.ts",
        apiPath: ["platform", "receive"],
      },
      {
        id: "SendUSDCTOUserLambda",
        folder: "receiveusdc",
        entryFile: "lambda_handler.ts",
        apiPath: ["receive"],
      },
    ];

    const cognitoPolicy = new iam.PolicyStatement({
      actions: [
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminGetUser",
      ],
      resources: [userPoolArn],
    });

    const secretsPolicy = new iam.PolicyStatement({
      actions: [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
      ],
      resources: [platformWalletSecret.secretArn],
    });

    // API Gateway
    const api = new apigw.RestApi(this, "CryptoApi", {
      restApiName: "Crypto API",
      description: "Web3 endpoints for wallet & USDC operations",
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
    });

    for (const fn of lambdas) {
      // Adjusted path: crypto/<folder>
      const lambdaFolderPath = path.join(__dirname, fn.folder);

      const lambdaFn = new lambdaNode.NodejsFunction(this, fn.id, {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(lambdaFolderPath, fn.entryFile),
        handler: "handler",
        environment: commonEnv,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: true,
          externalModules: ["aws-sdk"],
        },
      });

      lambdaFn.addToRolePolicy(cognitoPolicy);
      lambdaFn.addToRolePolicy(secretsPolicy);

      // API Gateway
      let resource: apigw.IResource = api.root;

      for (const segment of fn.apiPath) {
        // Check if the child resource already exists
        let child = resource.getResource(segment);
        if (!child) {
          child = resource.addResource(segment);
        }
        resource = child;
      }

      resource.addMethod("POST", new apigw.LambdaIntegration(lambdaFn));
    }

    new cdk.CfnOutput(this, "CryptoApiUrl", {
      value: api.url,
      description: "API Gateway endpoint for Crypto stack",
    });
  }
}

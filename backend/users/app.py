"""
AWS CDK Stack for Terrastride Users Service
"""

from aws_cdk import (
    App,
    Stack,
    CfnOutput,
    Duration,
    RemovalPolicy,
    aws_cognito as cognito,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_iam as iam,
)
from constructs import Construct


class TerrastrideUsersStack(Stack):
    """AWS CDK Stack for Terrastride Users Service"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Cognito User Pool
        user_pool = cognito.UserPool(
            self,
            "TerrastrideUsersUserPool",
            user_pool_name="TerrastrideUsersUserPool",
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            sign_in_aliases=cognito.SignInAliases(email=True),
            self_sign_up_enabled=True,
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
            ),
            custom_attributes={
                "name": cognito.StringAttribute(mutable=True),
                "six_digit_code": cognito.StringAttribute(mutable=True),
                "coin_balance": cognito.StringAttribute(mutable=True),
                "territory_blocks": cognito.StringAttribute(mutable=True),
                "created_at": cognito.StringAttribute(mutable=True),
            },
            removal_policy=RemovalPolicy.DESTROY,
        )

        # User Pool Client
        user_pool_client = cognito.UserPoolClient(
            self,
            "TerrastrideUsersUserPoolClient",
            user_pool=user_pool,
            user_pool_client_name="TerrastrideUsersWebApp",
            generate_secret=False,
            auth_flows=cognito.AuthFlow(
                user_srp=True,
                user_password=True,
                custom=False,
                admin_user_password=False,
            ),
            prevent_user_existence_errors=True,
        )

        # IAM Policy for Lambda functions to access Cognito
        cognito_policy = iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "cognito-idp:SignUp",
                "cognito-idp:AdminConfirmSignUp",
                "cognito-idp:InitiateAuth",
                "cognito-idp:GetUser",
                "cognito-idp:AdminGetUser",
            ],
            resources=[user_pool.user_pool_arn],
        )

        # Register User Lambda Function
        register_lambda = _lambda.Function(
            self,
            "RegisterUserLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,  # pylint: disable=no-member
                    "command": [
                        "bash",
                        "-c",
                        (
                            "cd register && "
                            "pip install aws-lambda-powertools fastjsonschema -t /asset-output && "
                            "cp -r . /asset-output && "
                            "cp ../middleware.py /asset-output"
                        ),
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "authentication",
                "USER_POOL_ID": user_pool.user_pool_id,
                "USER_POOL_CLIENT_ID": user_pool_client.user_pool_client_id,
            },
            timeout=Duration.seconds(30),
        )
        register_lambda.add_to_role_policy(cognito_policy)

        # Login User Lambda Function
        login_lambda = _lambda.Function(
            self,
            "LoginUserLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,  # pylint: disable=no-member
                    "command": [
                        "bash",
                        "-c",
                        (
                            "cd login && "
                            "pip install aws-lambda-powertools fastjsonschema -t /asset-output && "
                            "cp -r . /asset-output && "
                            "cp ../middleware.py /asset-output"
                        ),
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "authentication",
                "USER_POOL_ID": user_pool.user_pool_id,
                "USER_POOL_CLIENT_ID": user_pool_client.user_pool_client_id,
            },
            timeout=Duration.seconds(30),
        )
        login_lambda.add_to_role_policy(cognito_policy)

        # Get User Info Lambda Function
        get_user_info_lambda = _lambda.Function(
            self,
            "GetUserInfoLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,  # pylint: disable=no-member
                    "command": [
                        "bash",
                        "-c",
                        (
                            "cd getuserinfo && "
                            "pip install aws-lambda-powertools fastjsonschema -t /asset-output && "
                            "cp -r . /asset-output && "
                            "cp ../middleware.py /asset-output"
                        ),
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "authentication",
            },
            timeout=Duration.seconds(30),
        )
        get_user_info_lambda.add_to_role_policy(cognito_policy)

        # Resend Verification Lambda Function
        resend_verification_lambda = _lambda.Function(
            self,
            "ResendVerificationLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,  # pylint: disable=no-member
                    "command": [
                        "bash",
                        "-c",
                        (
                            "cd resendverification && "
                            "pip install aws-lambda-powertools fastjsonschema -t /asset-output && "
                            "cp -r . /asset-output && "
                            "cp ../middleware.py /asset-output"
                        ),
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "authentication",
                "USER_POOL_CLIENT_ID": user_pool_client.user_pool_client_id,
            },
            timeout=Duration.seconds(30),
        )
        resend_verification_lambda.add_to_role_policy(cognito_policy)

        # Send Verification Lambda Function
        send_verification_lambda = _lambda.Function(
            self,
            "SendVerificationLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,  # pylint: disable=no-member
                    "command": [
                        "bash",
                        "-c",
                        (
                            "cd sendverification && "
                            "pip install aws-lambda-powertools fastjsonschema -t /asset-output && "
                            "cp -r . /asset-output && "
                            "cp ../middleware.py /asset-output"
                        ),
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "authentication",
                "USER_POOL_CLIENT_ID": user_pool_client.user_pool_client_id,
            },
            timeout=Duration.seconds(30),
        )
        send_verification_lambda.add_to_role_policy(cognito_policy)

        # API Gateway
        api = apigw.RestApi(
            self,
            "TerrastrideUsersApi",
            rest_api_name="Terrastride Users API",
            description="Terrastride Users Services API",
            deploy=True,
            deploy_options=apigw.StageOptions(stage_name="users"),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=apigw.Cors.DEFAULT_HEADERS,
            ),
        )

        # API Gateway Integrations
        register_integration = apigw.LambdaIntegration(register_lambda)
        login_integration = apigw.LambdaIntegration(login_lambda)
        get_user_info_integration = apigw.LambdaIntegration(get_user_info_lambda)
        resend_verification_integration = apigw.LambdaIntegration(
            resend_verification_lambda
        )
        send_verification_integration = apigw.LambdaIntegration(
            send_verification_lambda
        )

        # API Gateway Resources and Methods
        api.root.add_resource("register").add_method("POST", register_integration)
        api.root.add_resource("login").add_method("POST", login_integration)
        api.root.add_resource("me").add_method("GET", get_user_info_integration)

        verification = api.root.add_resource("verification")
        verification.add_resource("resend").add_method(
            "POST", resend_verification_integration
        )
        verification.add_resource("send").add_method(
            "POST", send_verification_integration
        )

        # Outputs
        CfnOutput(
            self,
            "TerrastrideUsersApiEndpoint",
            description="Terrastride Users API Gateway URL",
            value=f"https://{api.rest_api_id}.execute-api.{self.region}.amazonaws.com/users",
        )

        CfnOutput(
            self,
            "UserPoolId",
            description="User Pool ID for Users",
            value=user_pool.user_pool_id,
            export_name="TerrastrideUsersUserPool",
        )

        CfnOutput(
            self,
            "UserPoolClientId",
            description="User Pool Client ID for Users",
            value=user_pool_client.user_pool_client_id,
        )

        CfnOutput(
            self,
            "UserPoolArn",
            description="User Pool ARN for Users",
            value=user_pool.user_pool_arn,
        )


app = App()
TerrastrideUsersStack(app, "TerrastrideUsersStack")
app.synth()

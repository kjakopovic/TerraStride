"""
AWS CDK Stack for Terrastride Territories Service
Defines DynamoDB table, Lambda functions, and API Gateway.
"""

import os
from aws_cdk import (
    App,
    Stack,
    CfnOutput,
    Duration,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_dynamodb as dynamodb,
    aws_iam as iam,
    RemovalPolicy,
)
from constructs import Construct


def lambda_bundling(directory: str):
    """Helper function for Lambda bundling configuration."""

    return {
        "image": _lambda.Runtime.PYTHON_3_12.bundling_image,  # pylint: disable=no-member
        "command": [
            "bash",
            "-c",
            (
                f"cd {directory} && "
                "pip install aws-lambda-powertools fastjsonschema -t /asset-output && "
                "cp -r . /asset-output && "
                "cp ../middleware.py /asset-output"
            ),
        ],
    }


class TerrastrideTerritoriesStack(Stack):
    """AWS CDK Stack for Terrastride Territories Service"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        user_pool_id = self.node.try_get_context("userPoolId")
        user_pool_arn = (
            f"arn:aws:cognito-idp:{self.region}:{self.account}:userpool/{user_pool_id}"
        )

        # Logs Database:
        # PK: id (UUID as string)
        frontend_logs_table = dynamodb.Table(
            self,
            "FrontendLogsTable",
            partition_key=dynamodb.Attribute(
                name="id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=None,
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Territories:
        # PK: id (UUID as string)
        # GSI: user_id-index -> partition user_id, sort created_at
        territories_table = dynamodb.Table(
            self,
            "TerritoriesTable",
            partition_key=dynamodb.Attribute(
                name="square_key", type=dynamodb.AttributeType.STRING
            ),
            sort_key=None,
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        territories_table.add_global_secondary_index(
            index_name="user_id-index",
            partition_key=dynamodb.Attribute(
                name="user_id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="created_at", type=dynamodb.AttributeType.STRING
            ),
            projection_type=dynamodb.ProjectionType.ALL,
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
                "cognito-idp:AdminUpdateUserAttributes",
            ],
            resources=[user_pool_arn],
        )

        # TODO: TEMPORARY FRONTEND LOGS TABLE
        fe_logs_lambda = _lambda.Function(
            self,
            "FrontendLogsLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("frontendlogs"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "territories",
                "FRONTEND_LOGS_TABLE": frontend_logs_table.table_name,
            },
            timeout=Duration.seconds(30),
        )
        frontend_logs_table.grant_read_write_data(fe_logs_lambda)

        # Healthcheck Lambda Function
        healthcheck_lambda = _lambda.Function(
            self,
            "HealthcheckLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("healthcheck"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "territories",
            },
            timeout=Duration.seconds(30),
        )

        # List territories Lambda Function
        list_territories_lambda = _lambda.Function(
            self,
            "ListTerritoriesLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("listterritories"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "territories",
                "TERRITORIES_TABLE": territories_table.table_name,
            },
            timeout=Duration.seconds(30),
        )

        assign_territories_lambda = _lambda.Function(
            self,
            "AssignTerritoriesLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("assignterritoriestouser"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "territories",
                "TERRITORIES_TABLE": territories_table.table_name,
                "USER_POOL_ID": user_pool_id,
            },
            timeout=Duration.seconds(30),
        )

        mine_territory_coins_lambda = _lambda.Function(
            self,
            "MineTerritoryCoinsLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("mineterritorycoins"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "territories",
                "TERRITORIES_TABLE": territories_table.table_name,
                "USER_POOL_ID": user_pool_id,
            },
            timeout=Duration.seconds(30),
        )

        # Grant Lambda read access to the DB secret
        territories_table.grant_read_write_data(list_territories_lambda)
        territories_table.grant_read_write_data(assign_territories_lambda)
        territories_table.grant_read_write_data(mine_territory_coins_lambda)

        list_territories_lambda.add_to_role_policy(cognito_policy)
        assign_territories_lambda.add_to_role_policy(cognito_policy)
        mine_territory_coins_lambda.add_to_role_policy(cognito_policy)

        # API Gateway
        api = apigw.RestApi(
            self,
            "TerrastrideTerritoriesApi",
            rest_api_name="Terrastride Territories API",
            description="Terrastride Territories Services API",
            deploy=True,
            deploy_options=apigw.StageOptions(stage_name="territories"),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=apigw.Cors.DEFAULT_HEADERS,
            ),
        )

        # API Gateway Integrations
        healthcheck_integration = apigw.LambdaIntegration(healthcheck_lambda)
        list_territories_integration = apigw.LambdaIntegration(list_territories_lambda)
        assign_territories_integration = apigw.LambdaIntegration(
            assign_territories_lambda
        )
        mine_territory_coins_integration = apigw.LambdaIntegration(
            mine_territory_coins_lambda
        )

        # API Gateway Resources and Methods
        api.root.add_resource("healthcheck").add_method("GET", healthcheck_integration)
        api.root.add_resource("mine").add_method(
            "POST", mine_territory_coins_integration
        )
        api.root.add_method("GET", list_territories_integration)
        api.root.add_method("POST", assign_territories_integration)

        # TODO: logs API resource
        api.root.add_resource("logs").add_method(
            "POST", apigw.LambdaIntegration(fe_logs_lambda)
        )

        # Outputs
        CfnOutput(
            self,
            "TerrastrideTerritoriesApiEndpoint",
            description="Terrastride Territories API Gateway URL",
            value=f"https://{api.rest_api_id}.execute-api.{self.region}.amazonaws.com/territories",
        )


app = App()
TerrastrideTerritoriesStack(
    app,
    "TerrastrideTerritoriesStack",
    env={
        "account": os.getenv("CDK_DEFAULT_ACCOUNT"),
        "region": os.getenv("CDK_DEFAULT_REGION", "eu-central-1"),
    },
)
app.synth()

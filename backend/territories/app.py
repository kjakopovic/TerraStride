import os
from aws_cdk import (
    App,
    Stack,
    CfnOutput,
    Duration,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_secretsmanager as sm,
    aws_ec2 as ec2,
)
from constructs import Construct


class TerrastrideTerritoriesStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        vpc_id = self.node.try_get_context("vpcId")
        sg_id = self.node.try_get_context("auroraSgId")
        db_secret_name = self.node.try_get_context("dbSecretName")
        user_pool_id = self.node.try_get_context("userPoolId")

        # Reference the Secret dynamically
        db_secret = sm.Secret.from_secret_name_v2(self, "DBSecret", db_secret_name)

        vpc = ec2.Vpc.from_lookup(self, "ImportedVPC", vpc_id=vpc_id)
        aurora_sg = ec2.SecurityGroup.from_security_group_id(
            self, "ImportedAuroraSG", sg_id
        )

        # Lambda security group for communication with Aurora
        lambda_sg = ec2.SecurityGroup(self, "LambdaSG", vpc=vpc)
        aurora_sg.add_ingress_rule(
            lambda_sg, ec2.Port.tcp(5432), "Allow Lambda to access Aurora"
        )

        # Healthcheck Lambda Function
        healthcheck_lambda = _lambda.Function(
            self,
            "HealthcheckLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd healthcheck && pip install aws-lambda-powertools fastjsonschema psycopg2-binary -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            vpc=vpc,
            security_groups=[lambda_sg],
            environment={
                "POWERTOOLS_SERVICE_NAME": "territories",
                "DB_SECRET_ARN": db_secret.secret_name,
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
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd listterritories && pip install aws-lambda-powertools fastjsonschema psycopg2-binary -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            vpc=vpc,
            security_groups=[lambda_sg],
            environment={
                "POWERTOOLS_SERVICE_NAME": "territories",
                "DB_SECRET_ARN": db_secret.secret_name,
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
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd assignterritoriestouser && pip install aws-lambda-powertools fastjsonschema psycopg2-binary -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            vpc=vpc,
            security_groups=[lambda_sg],
            environment={
                "POWERTOOLS_SERVICE_NAME": "territories",
                "DB_SECRET_ARN": db_secret.secret_name,
                "USER_POOL_ID": user_pool_id,
            },
            timeout=Duration.seconds(30),
        )

        # Grant Lambda read access to the DB secret
        db_secret.grant_read(healthcheck_lambda)
        db_secret.grant_read(list_territories_lambda)
        db_secret.grant_read(assign_territories_lambda)

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

        # API Gateway Resources and Methods
        api.root.add_resource("healthcheck").add_method("GET", healthcheck_integration)
        api.root.add_method("GET", list_territories_integration)
        api.root.add_method("POST", assign_territories_integration)

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

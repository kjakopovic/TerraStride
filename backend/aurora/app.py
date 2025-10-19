from aws_cdk import (
    App,
    Stack,
    RemovalPolicy,
    CfnOutput,
    Duration,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_lambda as _lambda,
    aws_secretsmanager as sm,
    aws_apigateway as apigw,
)
from constructs import Construct


class TerrastrideAuroraStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        vpc = ec2.Vpc(self, "AuroraVpc", max_azs=2)

        cluster = rds.DatabaseCluster(
            self,
            "AuroraServerlessCluster",
            engine=rds.DatabaseClusterEngine.aurora_postgres(
                version=rds.AuroraPostgresEngineVersion.VER_15_4
            ),
            credentials=rds.Credentials.from_username("terrastride_admin"),
            default_database_name="TerrastrideDB",
            writer=rds.ClusterInstance.serverless_v2("WriterInstance"),
            vpc=vpc,
            storage_encrypted=True,
            deletion_protection=False,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Lambda security group for communication with Aurora
        aurora_sg = cluster.connections.security_groups[0]
        lambda_sg = ec2.SecurityGroup(self, "LambdaSG", vpc=vpc)
        aurora_sg.add_ingress_rule(
            lambda_sg, ec2.Port.tcp(5432), "Allow Lambda to access Aurora"
        )
        db_secret_name = cluster.secret.secret_name

        # Reference the Secret dynamically
        db_secret = sm.Secret.from_secret_name_v2(self, "DBSecret", db_secret_name)

        # Migrations Lambda Function
        migrations_lambda = _lambda.Function(
            self,
            "MigrationsLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd migrations && pip install aws-lambda-powertools psycopg2-binary fastjsonschema -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            vpc=vpc,
            security_groups=[lambda_sg],
            environment={
                "POWERTOOLS_SERVICE_NAME": "aurora",
                "DB_SECRET_ARN": db_secret.secret_name,
            },
            timeout=Duration.seconds(30),
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
                        "cd healthcheck && pip install aws-lambda-powertools psycopg2-binary fastjsonschema -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
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

        # Grant Lambda read access to the DB secret
        db_secret.grant_read(migrations_lambda)
        db_secret.grant_read(healthcheck_lambda)

        # API Gateway
        api = apigw.RestApi(
            self,
            "TerrastrideDatabaseApi",
            rest_api_name="Terrastride Database API",
            description="Terrastride Database Services API",
            deploy=True,
            deploy_options=apigw.StageOptions(stage_name="aurora"),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=apigw.Cors.DEFAULT_HEADERS,
            ),
        )

        # API Gateway Integrations
        migrations_integration = apigw.LambdaIntegration(migrations_lambda)
        healthcheck_integration = apigw.LambdaIntegration(healthcheck_lambda)

        # API Gateway Resources and Methods
        api.root.add_resource("migrations").add_method("POST", migrations_integration)
        api.root.add_resource("healthcheck").add_method("GET", healthcheck_integration)

        # Outputs
        CfnOutput(
            self,
            "TerrastrideMigrationsApiEndpoint",
            description="Terrastride Migrations API Gateway URL",
            value=f"https://{api.rest_api_id}.execute-api.{self.region}.amazonaws.com/aurora",
        )
        CfnOutput(self, "AuroraEndpoint", value=cluster.cluster_endpoint.hostname)
        CfnOutput(self, "AuroraSecret", value=cluster.secret.secret_name)
        CfnOutput(self, "AuroraVPCId", value=vpc.vpc_id)
        CfnOutput(self, "AuroraSGId", value=aurora_sg.security_group_id)


app = App()
TerrastrideAuroraStack(app, "TerrastrideAuroraStack", env={"region": "eu-central-1"})
app.synth()

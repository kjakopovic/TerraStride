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


class TerrastrideEventsStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        vpc_id = self.node.try_get_context("vpcId")
        sg_id = self.node.try_get_context("auroraSgId")
        db_secret_name = self.node.try_get_context("dbSecretName")

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

        # Attend event Lambda Function
        attend_event_lambda = _lambda.Function(
            self,
            "AttendEventLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd attendevent && pip install aws-lambda-powertools fastjsonschema psycopg2-binary -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
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

        create_event_lambda = _lambda.Function(
            self,
            "CreateEventLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd createevent && pip install aws-lambda-powertools fastjsonschema psycopg2-binary -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
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

        delete_event_lambda = _lambda.Function(
            self,
            "DeleteEventLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd deleteevent && pip install aws-lambda-powertools fastjsonschema psycopg2-binary -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
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

        edit_event_lambda = _lambda.Function(
            self,
            "EditEventLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd editevent && pip install aws-lambda-powertools fastjsonschema psycopg2-binary -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
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

        list_events_lambda = _lambda.Function(
            self,
            "ListEventsLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling={
                    "image": _lambda.Runtime.PYTHON_3_12.bundling_image,
                    "command": [
                        "bash",
                        "-c",
                        "cd listevents && pip install aws-lambda-powertools fastjsonschema psycopg2-binary -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
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
        db_secret.grant_read(healthcheck_lambda)
        db_secret.grant_read(attend_event_lambda)
        db_secret.grant_read(create_event_lambda)
        db_secret.grant_read(delete_event_lambda)
        db_secret.grant_read(edit_event_lambda)
        db_secret.grant_read(list_events_lambda)

        # API Gateway
        api = apigw.RestApi(
            self,
            "TerrastrideEventsApi",
            rest_api_name="Terrastride Events API",
            description="Terrastride Events Services API",
            deploy=True,
            deploy_options=apigw.StageOptions(stage_name="events"),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=apigw.Cors.DEFAULT_HEADERS,
            ),
        )

        # API Gateway Integrations
        healthcheck_integration = apigw.LambdaIntegration(healthcheck_lambda)
        attend_event_integration = apigw.LambdaIntegration(attend_event_lambda)
        create_event_integration = apigw.LambdaIntegration(create_event_lambda)
        delete_event_integration = apigw.LambdaIntegration(delete_event_lambda)
        edit_event_integration = apigw.LambdaIntegration(edit_event_lambda)
        list_events_integration = apigw.LambdaIntegration(list_events_lambda)

        # API Gateway Resources and Methods

        # GET /events/healthcheck → check is service active and healthy
        api.root.add_resource("healthcheck").add_method("GET", healthcheck_integration)

        # POST /events/attend → attend event
        api.root.add_resource("attend").add_method("POST", attend_event_integration)

        # GET /events → list all events
        api.root.add_method("GET", list_events_integration)

        # POST /events → create event
        api.root.add_method("POST", create_event_integration)

        # /events/{event_id} resource
        event_id_resource = api.root.add_resource("{event_id}")

        # PUT /events/{event_id} → edit specific event
        event_id_resource.add_method("PUT", edit_event_integration)

        # DELETE /events/{event_id} → delete specific event
        event_id_resource.add_method("DELETE", delete_event_integration)

        # Outputs
        CfnOutput(
            self,
            "TerrastrideEventsApiEndpoint",
            description="Terrastride Events API Gateway URL",
            value=f"https://{api.rest_api_id}.execute-api.{self.region}.amazonaws.com/events",
        )


app = App()
TerrastrideEventsStack(
    app,
    "TerrastrideEventsStack",
    env={
        "account": os.getenv("CDK_DEFAULT_ACCOUNT"),
        "region": os.getenv("CDK_DEFAULT_REGION", "eu-central-1"),
    },
)
app.synth()

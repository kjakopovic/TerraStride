import os
from aws_cdk import (
    App,
    Stack,
    CfnOutput,
    Duration,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_dynamodb as dynamodb,
    RemovalPolicy,
    aws_iam as iam,
)
from constructs import Construct


class TerrastrideEventsStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        user_pool_id = self.node.try_get_context("userPoolId")
        user_pool_arn = (
            f"arn:aws:cognito-idp:{self.region}:{self.account}:userpool/{user_pool_id}"
        )

        # Events:
        # PK: id
        # GSI: city-index -> partition city, sort startdate (ISO string) for searching events by city
        events_table = dynamodb.Table(
            self,
            "EventsTable",
            partition_key=dynamodb.Attribute(
                name="id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        events_table.add_global_secondary_index(
            index_name="city-index",
            partition_key=dynamodb.Attribute(
                name="city", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="startdate", type=dynamodb.AttributeType.STRING
            ),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # Event tickets:
        # PK: event_id, SK: ticket_id (UUID)
        # GSI: user_id-index -> partition user_id to list tickets by user
        event_tickets_table = dynamodb.Table(
            self,
            "EventTicketsTable",
            partition_key=dynamodb.Attribute(
                name="event_id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(name="id", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        event_tickets_table.add_global_secondary_index(
            index_name="user_id-index",
            partition_key=dynamodb.Attribute(
                name="user_id", type=dynamodb.AttributeType.STRING
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
                        "cd healthcheck && pip install aws-lambda-powertools fastjsonschema -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
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
                        "cd attendevent && pip install aws-lambda-powertools fastjsonschema -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
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
                        "cd createevent && pip install aws-lambda-powertools fastjsonschema -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
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
                        "cd deleteevent && pip install aws-lambda-powertools fastjsonschema -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
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
                        "cd editevent && pip install aws-lambda-powertools fastjsonschema -t /asset-output && cp -r . /asset-output && cp ../middleware.py /asset-output",
                    ],
                },
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
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
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
            },
            timeout=Duration.seconds(30),
        )

        # Grant Lambda read access to the DB secret
        events_table.grant_read_write_data(attend_event_lambda)
        events_table.grant_read_write_data(create_event_lambda)
        events_table.grant_read_write_data(delete_event_lambda)
        events_table.grant_read_write_data(edit_event_lambda)
        events_table.grant_read_write_data(list_events_lambda)
        event_tickets_table.grant_read_write_data(attend_event_lambda)
        event_tickets_table.grant_read_write_data(create_event_lambda)
        event_tickets_table.grant_read_write_data(delete_event_lambda)
        event_tickets_table.grant_read_write_data(edit_event_lambda)
        event_tickets_table.grant_read_write_data(list_events_lambda)
        attend_event_lambda.add_to_role_policy(cognito_policy)

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

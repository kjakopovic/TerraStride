"""
AWS CDK Stack for Terrastride Events Service
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
    aws_events as events,
    aws_events_targets as targets,
    RemovalPolicy,
    aws_iam as iam,
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


class TerrastrideEventsStack(Stack):
    """
    AWS CDK Stack for Terrastride Events Service
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        user_pool_id = self.node.try_get_context("userPoolId")
        user_pool_arn = (
            f"arn:aws:cognito-idp:{self.region}:{self.account}:userpool/{user_pool_id}"
        )

        # Events:
        # PK: id
        # GSI: city-index -> partition city, sort startdate for searching events by city
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

        # Event Tickets:
        # PK: id
        # GSI: event_id-index -> partition event_id for searching tickets by event
        # GSI: user_id-index -> partition user_id for searching tickets by user
        event_tickets_table = dynamodb.Table(
            self,
            "EventTicketsTable",
            partition_key=dynamodb.Attribute(
                name="id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        events_table.add_global_secondary_index(
            index_name="enddate-index",
            partition_key=dynamodb.Attribute(
                name="is_distributed",
                type=dynamodb.AttributeType.NUMBER,
            ),
            sort_key=dynamodb.Attribute(
                name="enddate", type=dynamodb.AttributeType.STRING
            ),
        )

        event_tickets_table.add_global_secondary_index(
            index_name="user_id-index",
            partition_key=dynamodb.Attribute(
                name="user_id", type=dynamodb.AttributeType.STRING
            ),
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
                bundling=lambda_bundling("healthcheck"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
            },
            timeout=Duration.seconds(30),
        )

        # Buy event ticket Lambda Function
        buy_event_ticket_lambda = _lambda.Function(
            self,
            "BuyEventTicketLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("buyeventticket"),
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
                bundling=lambda_bundling("createevent"),
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
                bundling=lambda_bundling("deleteevent"),
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
                bundling=lambda_bundling("editevent"),
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
                bundling=lambda_bundling("listevents"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
            },
            timeout=Duration.seconds(30),
        )

        verify_event_ticket_lambda = _lambda.Function(
            self,
            "VerifyEventTicketLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("verifyeventticket"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
            },
            timeout=Duration.seconds(30),
        )

        finish_event_race_lambda = _lambda.Function(
            self,
            "FinishEventRaceLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("finisheventrace"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
            },
            timeout=Duration.seconds(30),
        )

        get_user_tickets_lambda = _lambda.Function(
            self,
            "GetUserTicketsLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("getusersactivetickets"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENT_TICKETS_TABLE": event_tickets_table.table_name,
            },
            timeout=Duration.seconds(30),
        )

        distribute_awards_lambda = _lambda.Function(
            self,
            "DistributeAwardsLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambda_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                ".",
                bundling=lambda_bundling("distributeawards"),
            ),
            environment={
                "POWERTOOLS_SERVICE_NAME": "events",
                "USER_POOL_ID": user_pool_id,
                "EVENTS_TABLE": events_table.table_name,
            },
            timeout=Duration.minutes(10),
        )

        # Grant Lambda read access to the DB secret
        events_table.grant_read_write_data(buy_event_ticket_lambda)
        events_table.grant_read_write_data(create_event_lambda)
        events_table.grant_read_write_data(delete_event_lambda)
        events_table.grant_read_write_data(edit_event_lambda)
        events_table.grant_read_write_data(list_events_lambda)
        events_table.grant_read_write_data(verify_event_ticket_lambda)
        events_table.grant_read_write_data(finish_event_race_lambda)
        events_table.grant_read_write_data(distribute_awards_lambda)

        event_tickets_table.grant_read_write_data(buy_event_ticket_lambda)
        event_tickets_table.grant_read_write_data(create_event_lambda)
        event_tickets_table.grant_read_write_data(delete_event_lambda)
        event_tickets_table.grant_read_write_data(edit_event_lambda)
        event_tickets_table.grant_read_write_data(list_events_lambda)
        event_tickets_table.grant_read_write_data(verify_event_ticket_lambda)
        event_tickets_table.grant_read_write_data(finish_event_race_lambda)
        event_tickets_table.grant_read_write_data(get_user_tickets_lambda)

        buy_event_ticket_lambda.add_to_role_policy(cognito_policy)
        distribute_awards_lambda.add_to_role_policy(cognito_policy)

        # CRON Job definition to run distribute awards daily at 22:00 UTC
        daily_rule = events.Rule(
            self,
            "DailyJobSchedule",
            schedule=events.Schedule.rate(duration=Duration.minutes(2)),
        )

        daily_rule.add_target(targets.LambdaFunction(distribute_awards_lambda))

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
        buy_event_ticket_integration = apigw.LambdaIntegration(buy_event_ticket_lambda)
        verify_event_ticket_integration = apigw.LambdaIntegration(
            verify_event_ticket_lambda
        )
        create_event_integration = apigw.LambdaIntegration(create_event_lambda)
        delete_event_integration = apigw.LambdaIntegration(delete_event_lambda)
        edit_event_integration = apigw.LambdaIntegration(edit_event_lambda)
        list_events_integration = apigw.LambdaIntegration(list_events_lambda)
        finish_event_race_integration = apigw.LambdaIntegration(
            finish_event_race_lambda
        )
        get_user_tickets_integration = apigw.LambdaIntegration(get_user_tickets_lambda)

        # API Gateway Resources and Methods

        # GET /events/healthcheck → check is service active and healthy
        api.root.add_resource("healthcheck").add_method("GET", healthcheck_integration)

        # /events/tickets resource
        tickets_resource = api.root.add_resource("tickets")

        # POST /events/tickets/buy → buy event ticket
        tickets_resource.add_resource("buy").add_method(
            "POST", buy_event_ticket_integration
        )

        # POST /events/tickets/{event_ticket_id}/verify → verify event ticket
        tickets_resource.add_resource("{event_ticket_id}").add_resource(
            "verify"
        ).add_method("POST", verify_event_ticket_integration)

        # GET /events → list all events
        api.root.add_method("GET", list_events_integration)

        # POST /events → create event
        api.root.add_method("POST", create_event_integration)

        # /events/{event_id} resource
        event_id_resource = api.root.add_resource("{event_id}")

        # POST /events/{event_id}/finish → finish event race
        event_id_resource.add_resource("finish").add_method(
            "POST", finish_event_race_integration
        )

        # GET /events/{event_id}/tickets → get user's active tickets for event
        event_id_resource.add_resource("tickets").add_method(
            "GET", get_user_tickets_integration
        )

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

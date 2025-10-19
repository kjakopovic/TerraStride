from aws_cdk import App, Stack, aws_ec2 as ec2, aws_rds as rds, RemovalPolicy, CfnOutput
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

        aurora_sg = cluster.connections.security_groups[0]

        CfnOutput(self, "AuroraEndpoint", value=cluster.cluster_endpoint.hostname)
        CfnOutput(self, "AuroraSecret", value=cluster.secret.secret_name)
        CfnOutput(self, "AuroraVPCId", value=vpc.vpc_id)
        CfnOutput(self, "AuroraSGId", value=aurora_sg.security_group_id)


app = App()
TerrastrideAuroraStack(app, "TerrastrideAuroraStack", env={"region": "eu-central-1"})
app.synth()

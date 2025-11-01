# Backend Setup

## TODO:

### LOGIC

- we need to add mining logic (possible cron job) - mine tokens, not coins, I will handle both to be in users table
- cron job for events finishment, every day at 22h (if event starts after, then it waits for the next day)
- web3 implementation for adding coins in game
- we need to add strava runs fetching for territory collection

### ENDPOINTS

create endpoint to receive all users active event tickets that they can consume
endpoint to consume a ticket to start running
endpoint to save their run
mining endpoint, similiar to hearts logic that was in gestura

## Architecture

This setup is for microservices setup in lambdas with cdk. Cdk is used for quick and easy deployment. Lambdas are representing endpoints which are being called on some event.

### Services

There are multiple services inside **backend** folder.
**aurora** - service which handles migrations for tables and deployment of aurora database
**territories** - service which handles territories for app
**users** - service which handles users and auth for app

### Service lookup

Inside each service there is **middleware.py** which handles error capturing for lambdas and all common functions that are used across multiple lambda functions. Also the main entrypoint for this cdk microservice is **app.py** which defines all aws services which are used in this stack.
Also, the one thing you are missing and need to add is **cdk.json**, basicly it mostly looks like this:

```json
{
  "app": "python3.12 app.py"
}
```

for territories use this:

```json
{
  "app": "python3.12 app.py",
  "context": {
    "vpcId": "",
    "auroraSgId": "",
    "dbSecretName": ""
  }
}
```

Those values are retrieved from aurora deployment. The flow is that after aurora deployment you set output values inside .env and run make generate-territories-cdk or you can add it directly to context.

Each endpoint is set inside it's own folder e.g. getuserinfo and inside there are:

- **lambda_handler.py** which is main endpoint file
- **(optional) validation_schema.py** which has definition for lambda powertools request validation handling
- **(optional) utils.py** which contains all helper methods used inside this lambda endpoint

## Build

Application is built with **cdk synth** and deployed with **cdk deploy**. If you want to override context values inside cdk.json use this command:
cdk deploy -c vpcId="VPC" -c auroraSgId="ID" -c dbSecretName="NAME"

Also you can use Makefile for building and deploying microservices, all services are predefined inside.

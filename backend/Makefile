# Default AWS Region
AWS_REGION ?= eu-central-1

# Default target (show help)
.DEFAULT_GOAL := help

# Service name must be passed, e.g. `make build SERVICE=users`
SERVICE ?=

# ---------------------------
# 💡 Generic reusable commands
# ---------------------------

help:
	@echo "Available commands:"
	@echo "  make build SERVICE=<service>        - Run 'cdk synth' in backend/<service>"
	@echo "  make deploy SERVICE=<service>       - Run 'cdk deploy' in backend/<service>"
	@echo "  make destroy SERVICE=<service>      - Run 'cdk destroy' in backend/<service>"
	@echo ""
	@echo "Example:"
	@echo "  make deploy SERVICE=users"

# --- Build (cdk synth)
build:
	@if [ -z "$(SERVICE)" ]; then echo "❌ Please provide SERVICE=<name>"; exit 1; fi
	cd ./$(SERVICE) && cdk synth --region $(AWS_REGION)

# --- Deploy
deploy:
	@if [ -z "$(SERVICE)" ]; then echo "❌ Please provide SERVICE=<name>"; exit 1; fi
	cd ./$(SERVICE) && cdk deploy --region $(AWS_REGION) --require-approval never

# --- Destroy
destroy:
	@if [ -z "$(SERVICE)" ]; then echo "❌ Please provide SERVICE=<name>"; exit 1; fi
	cd ./$(SERVICE) && cdk destroy --region $(AWS_REGION)

generate-cdk:
	@if [ -z "$(SERVICE)" ]; then echo "❌ Please provide SERVICE=<name>"; exit 1; fi
	cd ./scripts && python3 generate_cdk_json.py -e ../.env -o ../$(SERVICE)/cdk.json -k awsRegion userPoolId

# ---------------------------
# 💡 Shortcuts
# ---------------------------

build-users:      SERVICE=users
build-users:      build

deploy-users:     SERVICE=users
deploy-users:     deploy

build-territories:SERVICE=territories
build-territories:build

deploy-territories:SERVICE=territories
deploy-territories:deploy

build-events:SERVICE=events
build-events:build

deploy-events:SERVICE=events
deploy-events:deploy

build-crypto:SERVICE=crypto
build-crypto:build

deploy-crypto:SERVICE=crypto
deploy-crypto:deploy

# ---------------------------
# 💡 Scripts
# ---------------------------

generate-territories-cdk: SERVICE=territories
generate-territories-cdk: generate-cdk

generate-users-cdk: SERVICE=users
generate-users-cdk: generate-cdk

generate-events-cdk: SERVICE=events
generate-events-cdk: generate-cdk

generate-crypto-cdk: SERVICE=crypto
generate-crypto-cdk: generate-cdk
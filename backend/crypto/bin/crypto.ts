#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CryptoStack } from "../crypto-stack"; // adjust path as needed

const app = new cdk.App();
new CryptoStack(app, "CryptoStack", {
  /* optional props */
});

#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WsServerlessPatternsStack } from '../lib/ws-serverless-patterns-stack';

const app = new cdk.App();
new WsServerlessPatternsStack(app, 'ws-serverless-patterns');

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
  SignUpCommand,
  AdminConfirmSignUpCommand,
  InitiateAuthCommand,
  AdminAddUserToGroupCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";

import {
  SecretsManagerClient,
  GetRandomPasswordCommand,
} from '@aws-sdk/client-secrets-manager';

import {
  CloudFormationClient, 
  DescribeStacksCommand 
} from "@aws-sdk/client-cloudformation";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DeleteCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

export interface UsersData {
  apiEndpoint: string;
  userPool: string;
  userPoolClient: string;
  userPoolAdminGroupName: string;
  tableName: string;
}

export interface User {
  username: string;
  password: string;
  sub: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export class UsersTestFixture {
  private readonly stackName: string;
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly secretsManagerClient: SecretsManagerClient;
  private readonly cloudFormationClient: CloudFormationClient;
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly createdUsers: User[];

  private tableName: string;
  private userPool: string;
  private userPoolClient: string;
  private userPoolAdminGroupName: string;

  constructor(stackName: string) {
    this.stackName = stackName;
    this.cognitoClient = new CognitoIdentityProviderClient({});
    this.secretsManagerClient = new SecretsManagerClient();
    this.cloudFormationClient = new CloudFormationClient();
    this.documentClient = DynamoDBDocumentClient.from(new DynamoDBClient());
    this.createdUsers = [];
  }

  public async setup(): Promise<UsersData> {
    const stackOutputs = await this.getStackOutputs();
    this.tableName = stackOutputs.UsersTable;
    this.userPool = stackOutputs.UserPool;
    this.userPoolClient = stackOutputs.UserPoolClient;
    this.userPoolAdminGroupName = stackOutputs.UserPoolAdminGroupName;

    return {
      apiEndpoint: stackOutputs.UsersApi,
      userPool: stackOutputs.UserPool,
      userPoolClient: stackOutputs.UserPoolClient,
      userPoolAdminGroupName: stackOutputs.UserPoolAdminGroupName,
      tableName: stackOutputs.UsersTable,
    }
  }

  private async getStackOutputs(): Promise<Record<string, string>> {
    const response = await this.cloudFormationClient.send(
      new DescribeStacksCommand({ StackName: this.stackName })
    );
    
    const outputs = response.Stacks?.[0].Outputs || [];
    const result: Record<string, string> = {};

    for (const output of outputs) {
      if (output.OutputKey && output.OutputValue) {
        result[output.OutputKey] = output.OutputValue;
      }
    }
    return result;
  }
  
  public async createUser(username: string): Promise<User> {
    const randomPasswordCommand = new GetRandomPasswordCommand({
      ExcludeCharacters: '"\'`[]{}():;,$/\\<>|=&',
      RequireEachIncludedType: true,
    });
  
    const passwordResponse = await this.secretsManagerClient.send(randomPasswordCommand);
    const password = passwordResponse.RandomPassword || '';
    const userAttributes = [{
      Name: 'name',
      Value: username,
    }]
  
    const idpResponse = await this.cognitoClient.send(new SignUpCommand({
      ClientId: this.userPoolClient,
      Username: username,
      Password: password,
      UserAttributes: userAttributes,
    }));
  
    await this.cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: this.userPool,
        Username: username,
      })
    );
  
    const response = await this.cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
      ClientId: this.userPoolClient,
    }));
  
    const authenticationResult = response.AuthenticationResult;
    if (!authenticationResult) {
      throw new Error('AuthenticationResult is undefined');
    }
    
    const user = {
      username: username,
      password: password,
      sub: idpResponse.UserSub || '',
      idToken: authenticationResult.IdToken || '',
      accessToken: authenticationResult.AccessToken || '',
      refreshToken: authenticationResult.RefreshToken || '',
    }
    this.createdUsers.push(user);

    return user;
  }

  public async getUser(username: string, password: string, sub: string): Promise<User> {
    const response = await this.cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
      ClientId: this.userPoolClient,
    }));
  
    const authenticationResult = response.AuthenticationResult;
    if (!authenticationResult) {
      throw new Error('AuthenticationResult is undefined');
    }
    
    return {
      username: username,
      password: password,
      sub: sub,
      idToken: authenticationResult.IdToken || '',
      accessToken: authenticationResult.AccessToken || '',
      refreshToken: authenticationResult.RefreshToken || '',
    }
  }

  public async addUserToAdminGroup(username: string): Promise<void> {
    await this.cognitoClient.send(new AdminAddUserToGroupCommand({
      UserPoolId: this.userPool,
      Username: username,
      GroupName: this.userPoolAdminGroupName,
    }));
  }

  public async pushUserToCreatedUsers(user: User): Promise<void> {
    this.createdUsers.push(user);
  }

  public async tearDown(): Promise<void> {
    for (const user of this.createdUsers) {
      await this.clearDynamoTable(user.sub);
      await this.deleteUser(user.username);
    }
  }
  
  private async clearDynamoTable(userid: string): Promise<void> {
    await this.documentClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { 
          userid: userid,
        }
      })
    );
  }

  private async deleteUser(username: string): Promise<void> {
    try {
      await this.cognitoClient.send(
        new AdminDeleteUserCommand({
          UserPoolId: this.userPool,
          Username: username,
        }));
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) {
        throw error;
      }
    } 
  }
}

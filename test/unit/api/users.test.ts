// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { 
  APIGatewayEvent,
  Context,
} from 'aws-lambda';

import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

import { handler } from '../../../src/api/users';
import { mockClient } from 'aws-sdk-client-mock';
import { 
  v4 as uuidv4,
  validate as uuidValidate,
} from 'uuid';

import createUserEvent from '../../../events/event-post-user.json';
import deleteUserEvent from '../../../events/event-delete-user-by-id.json';
import getUserEvent from '../../../events/event-get-user-by-id.json';
import getUsersEvent from '../../../events/event-get-all-users.json';
import updateUserEvent from '../../../events/event-put-user.json';

process.env.USERS_TABLE = 'users';

const documentClientMock = mockClient(DynamoDBDocumentClient);

describe('Users api service', () => {
  const originalEnv = process.env;
  const context : Partial<Context> = { 
	  awsRequestId: "dummyAwsRequestId" 
	};

  beforeEach(() =>{
    process.env = {
      ...originalEnv,
      USERS_TABLE: 'users'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    documentClientMock.reset();
  });

  it('should be able to create a user', async() => {
    // Arrange
    const input = (createUserEvent as unknown) as APIGatewayEvent;
    const expectedResponse = JSON.parse(input.body || '{}');
    documentClientMock.on(PutCommand).resolves({});
    
    // Act
    const result = await handler(input, context as Context);
    const body = JSON.parse(result.body);

    // Assert
    expect(documentClientMock.calls()).toHaveLength(1);
    expect(result.statusCode).toBe(201);
    expect(uuidValidate(body['userid'])).toBeTruthy;
    expect(body['timestamp']).toBeDefined
    expect(body['name']).toEqual(expectedResponse['name']);
  });

  it('should be able to delete a user', async() => {
    // Arrange
    const input = (deleteUserEvent as unknown) as APIGatewayEvent;
    documentClientMock.on(DeleteCommand).resolves({});

    // Act
    const result = await handler(input, context as Context);
    const body = JSON.parse(result.body);

    // Assert
    expect(documentClientMock.calls()).toHaveLength(1);
    expect(result.statusCode).toBe(200);
    expect(body).toEqual({});
  });

  it('should be able to get a user', async() => {
    // Arrange
    const input = (getUserEvent as unknown) as APIGatewayEvent;
    const expectedResponse = {
      userid: uuidv4(),
      name: 'John Smith',
      timestamp: new Date().toISOString(), 
    }
    documentClientMock.on(GetCommand).resolves({
      Item: {
        ...expectedResponse,
      },
    });

    // Act
    const result = await handler(input, context as Context);
    const body = JSON.parse(result.body);

    // Assert
    expect(documentClientMock.calls()).toHaveLength(1);
    expect(result.statusCode).toBe(200);
    expect(body).toEqual(expectedResponse);
  });

  it('should get a 200 with no body when user does not exist', async() => {
    // Arrange
    const input = (getUserEvent as unknown) as APIGatewayEvent;
    documentClientMock.on(GetCommand).resolves({});

    // Act
    const result = await handler(input, context as Context);
    const body = JSON.parse(result.body);

    // Assert
    expect(documentClientMock.calls()).toHaveLength(1);
    expect(result.statusCode).toBe(200);
    expect(body).toEqual({});
  });

  it('should be able to get all users', async() => {
    // Arrange
    const input = (getUsersEvent as unknown) as APIGatewayEvent;
    const expectedResponse = [
      {
        userid: uuidv4(),
        name: 'John Smith',
        timestamp: new Date().toISOString(), 
      },
      {
        userid: uuidv4(),
        name: 'Jackie Smith',
        timestamp: new Date().toISOString(), 
      },
    ];
    documentClientMock.on(ScanCommand).resolves({
      Items: [
        ...expectedResponse,
      ]
    });
    // Act
    const result = await handler(input, context as Context);
    const body = JSON.parse(result.body);

    // Assert
    expect(documentClientMock.calls()).toHaveLength(1);
    expect(result.statusCode).toBe(200);
    expect(body).toEqual(expectedResponse);
  });

  it('should be able to update a user', async() => {
    // Arrange
    const input = (updateUserEvent as unknown) as APIGatewayEvent;
    const expectedResponse = JSON.parse(input.body || '{}');
    documentClientMock.on(PutCommand).resolves({});
    
    // Act
    const result = await handler(input, context as Context);
    const body = JSON.parse(result.body);

    // Assert
    expect(documentClientMock.calls()).toHaveLength(1);
    expect(result.statusCode).toBe(200);
    expect(body['name']).toEqual(expectedResponse['name']);
  }); 
});

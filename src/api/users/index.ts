// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { 
  Context,
  APIGatewayProxyResult,
  APIGatewayEvent
} from 'aws-lambda';

import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';

import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

import { v4 as uuidv4 } from 'uuid';

const USERS_TABLE = process.env.USERS_TABLE || '';
const dynamoDb = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(dynamoDb);

enum UserRoutes {
  CREATE_USER = 'POST /users',
  DELETE_USER = 'DELETE /users/{userid}',
  GET_USER = 'GET /users/{userid}',
  GET_USERS = 'GET /users',
  UPDATE_USER = 'PUT /users/{userid}'
}

export const handler = (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  let response: Promise<APIGatewayProxyResult>;
    
  switch (`${event.httpMethod} ${event.resource}`) {
    case UserRoutes.CREATE_USER:
      response = createUser(event);
      break;
    case UserRoutes.DELETE_USER:
      response = deleteUser(event);
      break;
    case UserRoutes.GET_USER:
      response = getUser(event);
      break;
    case UserRoutes.GET_USERS:
      response = getUsers();
      break;
    case UserRoutes.UPDATE_USER:
      response = updateUser(event);
      break;
    default:
      response = Promise.resolve({
        statusCode: 400,
        headers: { ...defaultHeaders, },
        body: JSON.stringify({
          message: 'Unsupported route',
        }),
      });
      break;
  }

  return response
    .catch(error => {
      console.log(error);
      return {
        statusCode: 400,
        headers: { ...defaultHeaders, },
        body: JSON.stringify({'Error': error}),
      }
    });
};

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const createUser = (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const body = JSON.parse(event.body || '{}');
  body['timestamp'] = new Date().toISOString();
  body['userid'] = uuidv4();
  return documentClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      ...body,
    },
  })).then(() => { 
    return {
      statusCode: 201,
      headers: { ...defaultHeaders, },
      body: JSON.stringify(body),
    }
  });
}

const deleteUser = (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const { userid } = event.pathParameters || {};

  return documentClient.send(new DeleteCommand({
    TableName: USERS_TABLE,
    Key: {
      "userid": userid,
    },
  })).then(() => {
    return {
      statusCode: 200,
      headers: { ...defaultHeaders, },
      body: JSON.stringify({}),
    }
  });
}

const getUser = (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const { userid } = event.pathParameters || {};

  return documentClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: {
      "userid": userid,
    }
  })).then(data => {
    return {
      statusCode: 200,
      headers: { ...defaultHeaders, },
      body: JSON.stringify(data.Item || {}),
    }
  });
}

const getUsers = (): Promise<APIGatewayProxyResult> => {
  return documentClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    Select: 'ALL_ATTRIBUTES',
  })).then(data => {
    return {
      statusCode: 200,
      headers: { ...defaultHeaders, },
      body: JSON.stringify(data.Items),
    }
  });
}

const updateUser = (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const { userid } = event.pathParameters || {};
  const body = JSON.parse(event.body || '{}');
  body['timestamp'] = new Date().toISOString();
  body['userid'] = userid;  

  return documentClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      ...body,
    },
  })).then(() => {
    return {
      statusCode: 200,
      headers: { ...defaultHeaders, },
      body: JSON.stringify(body),
    }
  });
}

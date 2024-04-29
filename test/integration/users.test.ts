// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import axios, { AxiosError } from 'axios';
import { faker } from '@faker-js/faker';

import {
  UsersTestFixture,
  User,
  UsersData, 
} from './users-fixture';

import env from './env.json';

describe('Users api service', () => {
  const fixture = new UsersTestFixture(env.stack_name);
  let config: UsersData;

  beforeAll(async () => {
    config = await fixture.setup();
  }, 10000);

  afterAll(async () => {
    await fixture.tearDown();
  });

  describe('Unauthenticated user', () => {
    it('should not have access to api', async () => {
      try {
        // Act
        await axios.get(`${config.apiEndpoint}users`);

        fail('Error expected for unathenticated user')
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(AxiosError);
        expect((error as AxiosError).response?.status).toBe(401);
      }
    });
  });

  describe('Regular user', () => {
    let regularUser: User;

    beforeAll(async () => {
      const username = faker.internet.userName();
      regularUser = await fixture.createUser(`${username}@example.com`);
    });
    
    it('should not be able to call admin get all users', async () => {
      try {
        // Act
        await axios.get(
          `${config.apiEndpoint}users`,
          { headers: {
              Authorization: `${regularUser.idToken}`
            }
          });

        fail('Error expected for non-admin user calling admin endpoint'); 
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(AxiosError);
        expect((error as AxiosError).response?.status).toBe(403);
      }
    });

    it('should not be able to call admin create user', async () => {
      // Arrange
      const name = faker.person.fullName();

      try {
        // Act
        await axios.post(
          `${config.apiEndpoint}users`, 
          { name: name }, 
          { headers: {
              Authorization: `${regularUser.idToken}`,
              'Content-Type': 'application/json',
            },
          });

        fail('Error expected for non-admin user calling admin endpoint'); 
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(AxiosError);
        expect((error as AxiosError).response?.status).toBe(403);
      }
    });

    it('should be able to get user', async () => {
      // Act
      const response = await axios.get(
        `${config.apiEndpoint}users/${regularUser.sub}`, 
        { headers: {
            Authorization: `${regularUser.idToken}`
          }
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.data).toEqual({});
    });

    it('should be able to update user', async () => {
      // Arrange
      const name = faker.person.fullName();

      // Act
      const response = await axios.put(
        `${config.apiEndpoint}users/${regularUser.sub}`,
        { name: name},
        { headers: {
            Authorization: `${regularUser.idToken}`,
            'Content-Type': 'application/json',
          },
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.data['name']).toEqual(name);
    });


  });
  describe('Admin user', () => {
    let adminUser: User;
    let createdUser: any;
    beforeAll(async () => {
      const username = faker.internet.userName();
      adminUser = await fixture.createUser(`${username}@example.com`);

      await fixture.addUserToAdminGroup(adminUser.username);

      // Old authentication won't have new admin group authorization
      adminUser = await fixture.getUser(adminUser.username, adminUser.password, adminUser.sub);
    });

    it('should able to call admin get all users', async () => {
      // Act
      const response = await axios.get(
        `${config.apiEndpoint}users`,
        { headers: {
            Authorization: `${adminUser.idToken}`
          }
        });

      // Assert
      expect(response.status).toBe(200);
    });

    it('should able to call admin create user', async () => {
      // Arrange
      const name = faker.person.fullName();

      // Act
      const response = await axios.post(
        `${config.apiEndpoint}users`,
        { name: name },
        { headers: {
            Authorization: `${adminUser.idToken}`,
            'Content-Type': 'application/json',
          },
        });
      createdUser = response.data;
      console.log(response);
      // Assert
      expect(response.status).toBe(201);
      expect(response.data['name']).toEqual(name);
    });

    it('should able to call admin delete user', async () => {
      // Arrange
      const id = createdUser.userid;

      // Act
      const response = await axios.delete(
        `${config.apiEndpoint}users/${id}`,
        { headers: {
            Authorization: `${adminUser.idToken}`,
          }
        });

      // Assert
      expect(response.status).toBe(200);
      console.log(response.data);
      expect(response.data).toEqual({});
    });
  });
});

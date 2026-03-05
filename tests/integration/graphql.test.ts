import request from 'supertest';
import { createAppWithGraphQL } from '@/app';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { signAccessToken } from '@/utils/tokenUtils';
import { Application } from 'express';

let app: Application;

beforeAll(async () => {
  app = await createAppWithGraphQL();
});

async function seedAndToken() {
  const user = await User.create({
    name: 'GraphQL User',
    email: `gql${Date.now()}@test.com`,
    password: 'password123',
  });
  const token = signAccessToken({ userId: user._id.toString(), role: 'user' });
  const project = await Project.create({
    name: 'GQL Project',
    description: 'graphql test project',
    owner: user._id,
    members: [user._id],
  });
  return { user, token, project };
}

async function gqlRequest(query: string, variables?: Record<string, unknown>, token?: string) {
  const req = request(app)
    .post('/graphql')
    .send({ query, variables });
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

describe('GraphQL API', () => {
  it('query tasks returns a paginated list', async () => {
    const { user, token, project } = await seedAndToken();
    await Task.create({
      title: 'GQL Task',
      description: 'desc',
      assignee: user._id,
      project: project._id,
    });

    const res = await gqlRequest(
      `query { tasks { data { id title status } total page limit totalPages hasMore } }`,
      undefined,
      token,
    );

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(Array.isArray(res.body.data.tasks.data)).toBe(true);
    expect(res.body.data.tasks).toHaveProperty('total');
  });

  it('query tasks returns 401 without auth', async () => {
    const res = await gqlRequest(`query { tasks { data { id } total page limit totalPages hasMore } }`);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/authentication/i);
  });

  it('mutation createTask creates a task', async () => {
    const { user, token, project } = await seedAndToken();

    const res = await gqlRequest(
      `mutation CreateTask($title: String!, $description: String!, $project: ID!, $assignee: ID!) {
        createTask(title: $title, description: $description, project: $project, assignee: $assignee) {
          id title status priority
        }
      }`,
      {
        title: 'Mutation Task',
        description: 'Created via GraphQL mutation',
        project: project._id.toString(),
        assignee: user._id.toString(),
      },
      token,
    );

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createTask.title).toBe('Mutation Task');
  });

  it('mutation signup creates a user', async () => {
    const res = await gqlRequest(
      `mutation {
        signup(name: "GQL Signup", email: "gqlsignup${Date.now()}@test.com", password: "password123") {
          accessToken
          refreshToken
          user { id name email }
        }
      }`,
    );

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.signup).toHaveProperty('accessToken');
    expect(res.body.data.signup.user).toHaveProperty('name', 'GQL Signup');
  });

  it('query me returns current user info', async () => {
    const { token } = await seedAndToken();
    const res = await gqlRequest(`query { me { id name email role } }`, undefined, token);

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.me).toHaveProperty('name', 'GraphQL User');
  });
});

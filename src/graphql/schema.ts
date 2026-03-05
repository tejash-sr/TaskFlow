import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar Date

  enum TaskStatus {
    todo
    in_progress
    review
    done
  }

  enum TaskPriority {
    low
    medium
    high
    urgent
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    createdAt: Date
  }

  type Project {
    id: ID!
    name: String!
    description: String
    status: String!
    owner: User
    members: [User!]!
    createdAt: Date
  }

  type Task {
    id: ID!
    title: String!
    description: String!
    status: String!
    priority: String!
    assignee: User
    project: Project
    tags: [String!]!
    dueDate: Date
    completedAt: Date
    createdAt: Date
    updatedAt: Date
  }

  type PaginatedTasks {
    data: [Task!]!
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
    hasMore: Boolean!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type Query {
    tasks(page: Int, limit: Int, status: String, priority: String): PaginatedTasks!
    task(id: ID!): Task
    projects: [Project!]!
    project(id: ID!): Project
    me: User
  }

  type Mutation {
    createTask(
      title: String!
      description: String!
      project: ID!
      assignee: ID!
      status: String
      priority: String
      dueDate: Date
    ): Task!

    updateTask(
      id: ID!
      title: String
      description: String
      status: String
      priority: String
    ): Task!

    deleteTask(id: ID!): Boolean!

    createProject(
      name: String!
      description: String
    ): Project!

    signup(name: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
  }
`;

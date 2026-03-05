import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TaskFlow API',
      version: '1.0.0',
      description:
        'A RESTful task management API with JWT authentication, file uploads, real-time events, and GraphQL support.',
      contact: {
        name: 'TaskFlow API',
        url: 'https://github.com/taskflow',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API base path',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '64abc123' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '64abc123' },
            title: { type: 'string', example: 'Fix login bug' },
            description: { type: 'string', example: 'Users cannot log in with special chars' },
            status: {
              type: 'string',
              enum: ['todo', 'in-progress', 'review', 'done'],
              example: 'todo',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              example: 'medium',
            },
            assignee: { $ref: '#/components/schemas/User' },
            project: { type: 'string', example: '64abc456' },
            dueDate: { type: 'string', format: 'date-time' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '64abc456' },
            name: { type: 'string', example: 'TaskFlow MVP' },
            description: { type: 'string', example: 'Main project for MVP delivery' },
            owner: { $ref: '#/components/schemas/User' },
            members: {
              type: 'array',
              items: { $ref: '#/components/schemas/User' },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '64abc789' },
            body: { type: 'string', example: 'This should be fixed by end of sprint' },
            author: { $ref: '#/components/schemas/User' },
            task: { type: 'string', example: '64abc123' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        PaginatedTasks: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
            total: { type: 'integer', example: 42 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 3 },
            hasMore: { type: 'boolean', example: true },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Something went wrong' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);

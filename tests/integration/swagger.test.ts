/**
 * Integration test for Swagger/OpenAPI documentation endpoint.
 */
import request from 'supertest';
import { createAppWithHandlers } from '@/app';

const app = createAppWithHandlers();

describe('Swagger / OpenAPI docs', () => {
  it('GET /api-docs.json returns a valid OpenAPI spec', async () => {
    const res = await request(app).get('/api-docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('TaskFlow API');
    expect(res.body.paths).toBeDefined();
  });

  it('GET /api-docs returns the Swagger UI HTML', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });

  it('OpenAPI spec has auth, tasks, and projects paths', async () => {
    const res = await request(app).get('/api-docs.json');

    const paths = Object.keys(res.body.paths ?? {});
    const hasAuth = paths.some((p) => p.startsWith('/auth/'));
    const hasTasks = paths.some((p) => p.startsWith('/tasks'));
    const hasProjects = paths.some((p) => p.startsWith('/projects'));

    expect(hasAuth).toBe(true);
    expect(hasTasks).toBe(true);
    expect(hasProjects).toBe(true);
  });

  it('OpenAPI spec includes security schemes', async () => {
    const res = await request(app).get('/api-docs.json');

    expect(res.body.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(res.body.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(res.body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });
});

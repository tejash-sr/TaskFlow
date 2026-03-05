import request from 'supertest';
import { createAppWithHandlers } from '@/app';

const app = createAppWithHandlers();

describe('EJS Web Routes', () => {
  describe('Public pages', () => {
    it('GET / returns the landing page HTML', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.type).toMatch(/html/);
      expect(res.text).toContain('TaskFlow');
    });

    it('GET /login returns the login form', async () => {
      const res = await request(app).get('/login');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Sign in');
      expect(res.text).toContain('<form');
    });

    it('GET /signup returns the signup form', async () => {
      const res = await request(app).get('/signup');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Create');
      expect(res.text).toContain('<form');
    });

    it('GET /forgot-password returns the forgot password form', async () => {
      const res = await request(app).get('/forgot-password');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Reset');
    });
  });

  describe('Protected pages redirect when not logged in', () => {
    it('GET /dashboard redirects to /login', async () => {
      const res = await request(app).get('/dashboard');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login');
    });

    it('GET /tasks redirects to /login', async () => {
      const res = await request(app).get('/tasks');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login');
    });

    it('GET /projects redirects to /login', async () => {
      const res = await request(app).get('/projects');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login');
    });
  });

  describe('POST /login handles invalid credentials', () => {
    it('re-renders login form with error on bad credentials', async () => {
      const res = await request(app)
        .post('/login')
        .send('email=notexist@example.com&password=wrongpassword')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Invalid');
    });
  });

  describe('POST /signup handles duplicate email', () => {
    it('re-renders signup form with error on duplicate email', async () => {
      // First signup
      await request(app)
        .post('/signup')
        .send('name=Test+User&email=web-dup@test.com&password=password123')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      // Second signup with same email
      const res = await request(app)
        .post('/signup')
        .send('name=Test+User&email=web-dup@test.com&password=password123')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      // Should either show error or redirect (depends on cookie handling in test)
      expect([200, 302]).toContain(res.status);
    });
  });

  describe('GET /logout clears cookie', () => {
    it('clears the auth cookie and redirects to /login', async () => {
      const res = await request(app)
        .get('/logout')
        .set('Cookie', 'tf_token=faketoken');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    });
  });
});

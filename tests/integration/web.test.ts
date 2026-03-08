/**
 * Integration tests for EJS web routes (web.routes.ts)
 * Covers public pages, auth flow, protected routes, and form submissions.
 */
import request from 'supertest';
import { createAppWithHandlers } from '@/app';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import Comment from '@/models/Comment.model';
import { signAccessToken } from '@/utils/tokenUtils';

const app = createAppWithHandlers();

/** Seed a user + project + task and return cookie header */
async function seedWithCookie(suffix = Date.now()) {
  const user = await User.create({
    name: 'Web Tester',
    email: `web${suffix}@test.com`,
    password: 'password123',
    isVerified: true,
  });
  const token = signAccessToken({ userId: user._id.toString(), role: 'user' });
  const cookie = `tf_token=${token}`;

  const project = await Project.create({
    name: 'Web Test Project',
    description: 'for web tests',
    owner: user._id,
    members: [user._id],
  });

  const task = await Task.create({
    title: 'Web Test Task',
    description: 'web task desc',
    assignee: user._id,
    project: project._id,
    status: 'todo',
    priority: 'medium',
  });

  return { user, token, cookie, project, task };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — public pages', () => {
  it('GET / returns 200 HTML for unauthenticated visitor', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET / redirects to /dashboard for authenticated user', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/dashboard');
  });

  it('GET /login returns 200 HTML', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /login redirects to /dashboard if already authenticated', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/login').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/dashboard');
  });

  it('GET /signup returns 200 HTML', async () => {
    const res = await request(app).get('/signup');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /signup redirects if already authenticated', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/signup').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/dashboard');
  });

  it('GET /forgot-password returns 200', async () => {
    const res = await request(app).get('/forgot-password');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /reset-password without token redirects to /forgot-password', async () => {
    const res = await request(app).get('/reset-password');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/forgot-password');
  });

  it('GET /reset-password with token returns 200', async () => {
    const res = await request(app).get('/reset-password?token=sometoken');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /verify-email without token returns 200 with error state', async () => {
    const res = await request(app).get('/verify-email');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /verify-email with invalid token returns 200', async () => {
    const res = await request(app).get('/verify-email?token=badtoken');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /resend-verification returns 200', async () => {
    const res = await request(app).get('/resend-verification');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /logout clears cookie and redirects to /login', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/logout').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });

  it('GET /logout without token still redirects to /login', async () => {
    const res = await request(app).get('/logout');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH FORMS
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — auth form submissions', () => {
  it('POST /login with valid credentials sets cookie and redirects', async () => {
    await User.create({ name: 'Login Web', email: 'loginweb@test.com', password: 'password123' });
    const res = await request(app)
      .post('/login')
      .send('email=loginweb@test.com&password=password123')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/dashboard');
  });

  it('POST /login with wrong password re-renders login with error', async () => {
    await User.create({ name: 'WrongPw User', email: 'wrongpw@test.com', password: 'password123' });
    const res = await request(app)
      .post('/login')
      .send('email=wrongpw@test.com&password=wrongpassword')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('POST /signup with valid data redirects to /dashboard', async () => {
    const res = await request(app)
      .post('/signup')
      .send('name=SignupWeb&email=signupweb@test.com&password=password123&confirmPassword=password123')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/dashboard');
  });

  it('POST /signup with mismatched passwords re-renders signup', async () => {
    const res = await request(app)
      .post('/signup')
      .send('name=X&email=mismatch@test.com&password=password123&confirmPassword=different')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('POST /signup without confirmPassword re-renders with error', async () => {
    const res = await request(app)
      .post('/signup')
      .send('name=X&email=noconfirm@test.com&password=password123')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('POST /forgot-password with valid email renders success message', async () => {
    await User.create({ name: 'FP User', email: 'fpuser@test.com', password: 'password123' });
    const res = await request(app)
      .post('/forgot-password')
      .send('email=fpuser@test.com')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('POST /reset-password missing token re-renders with error', async () => {
    const res = await request(app)
      .post('/reset-password')
      .send('password=newpassword123&confirmPassword=newpassword123')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('POST /reset-password with password mismatch re-renders with error', async () => {
    const res = await request(app)
      .post('/reset-password')
      .send('token=sometoken&password=newpass123&confirmPassword=different')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('POST /reset-password with short password re-renders with error', async () => {
    const res = await request(app)
      .post('/reset-password')
      .send('token=sometoken&password=short&confirmPassword=short')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('POST /resend-verification with unknown email renders message', async () => {
    const res = await request(app)
      .post('/resend-verification')
      .send('email=unknown@test.com')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES — unauthenticated redirects
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — unauthenticated redirects', () => {
  it('GET /dashboard redirects to /login', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });

  it('GET /tasks redirects to /login', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });

  it('GET /tasks/new redirects to /login', async () => {
    const res = await request(app).get('/tasks/new');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });

  it('GET /projects redirects to /login', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });

  it('GET /projects/new redirects to /login', async () => {
    const res = await request(app).get('/projects/new');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });

  it('GET /profile redirects to /login', async () => {
    const res = await request(app).get('/profile');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — authenticated access', () => {
  it('GET /dashboard returns 200 HTML', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/dashboard').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /tasks returns 200 HTML', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/tasks').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /tasks with filters returns 200', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/tasks?status=todo&priority=high').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('GET /tasks with search query returns 200', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/tasks?search=web').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('GET /tasks/new returns 200 HTML', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/tasks/new').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /tasks/:id returns 200 HTML for existing task', async () => {
    const { cookie, task } = await seedWithCookie();
    const res = await request(app)
      .get(`/tasks/${task._id.toString()}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /tasks/:id with invalid id redirects to /tasks', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app)
      .get('/tasks/nonexistentid')
      .set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/tasks');
  });

  it('GET /projects returns 200 HTML', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/projects').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /projects/new returns 200 HTML', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/projects/new').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /projects/:id returns 200 HTML for existing project', async () => {
    const { cookie, project } = await seedWithCookie();
    const res = await request(app)
      .get(`/projects/${project._id.toString()}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('GET /projects/:id with invalid id redirects to /projects', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app)
      .get('/projects/badid')
      .set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/projects');
  });

  it('GET /projects/:id with flash success shows page', async () => {
    const { cookie, project } = await seedWithCookie();
    const res = await request(app)
      .get(`/projects/${project._id.toString()}?success=Member+added`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('GET /projects/:id with flash error shows page', async () => {
    const { cookie, project } = await seedWithCookie();
    const res = await request(app)
      .get(`/projects/${project._id.toString()}?error=Something+went+wrong`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('GET /profile returns 200 HTML', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app).get('/profile').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM SUBMISSIONS — tasks
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — task form submissions', () => {
  it('POST /tasks with project creates task and redirects', async () => {
    const { cookie, project } = await seedWithCookie();
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', cookie)
      .send(`title=New+Web+Task&description=desc&status=todo&priority=medium&project=${project._id.toString()}`)
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/tasks');
  });

  it('POST /tasks without project re-renders new with error', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app)
      .post('/tasks')
      .set('Cookie', cookie)
      .send('title=Task&description=desc')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/html/);
  });

  it('POST /tasks/:id/update redirects back to task', async () => {
    const { cookie, task } = await seedWithCookie();
    const res = await request(app)
      .post(`/tasks/${task._id.toString()}/update`)
      .set('Cookie', cookie)
      .send('title=Updated+Task&description=new+desc')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
  });

  it('POST /tasks/:id/status redirects', async () => {
    const { cookie, task } = await seedWithCookie();
    const res = await request(app)
      .post(`/tasks/${task._id.toString()}/status`)
      .set('Cookie', cookie)
      .send('status=in-progress')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
  });

  it('POST /tasks/:id/comments creates comment and redirects', async () => {
    const { cookie, task } = await seedWithCookie();
    const res = await request(app)
      .post(`/tasks/${task._id.toString()}/comments`)
      .set('Cookie', cookie)
      .send('body=A+web+comment')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
  });

  it('POST /tasks/:id/delete soft-deletes and redirects to /tasks', async () => {
    const { cookie, task } = await seedWithCookie();
    const res = await request(app)
      .post(`/tasks/${task._id.toString()}/delete`)
      .set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/tasks');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM SUBMISSIONS — projects
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — project form submissions', () => {
  it('POST /projects creates project and redirects', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app)
      .post('/projects')
      .set('Cookie', cookie)
      .send('name=New+Web+Project&description=Testing')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/projects');
  });

  it('POST /projects/:id/members adds member and redirects', async () => {
    const { cookie, project } = await seedWithCookie();
    const member = await User.create({
      name: 'Web Member',
      email: `webmember${Date.now()}@test.com`,
      password: 'password123',
    });
    const res = await request(app)
      .post(`/projects/${project._id.toString()}/members`)
      .set('Cookie', cookie)
      .send(`email=${member.email}`)
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
  });

  it('POST /projects/:id/members with bad email redirects with error', async () => {
    const { cookie, project } = await seedWithCookie();
    const res = await request(app)
      .post(`/projects/${project._id.toString()}/members`)
      .set('Cookie', cookie)
      .send('email=notfound@nowhere.com')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('error');
  });

  it('POST /projects/:id/members/:memberId/remove removes and redirects', async () => {
    const { cookie, project, user } = await seedWithCookie();
    const res = await request(app)
      .post(`/projects/${project._id.toString()}/members/${user._id.toString()}/remove`)
      .set('Cookie', cookie);
    expect(res.status).toBe(302);
  });

  it('POST /projects/:id/delete deletes and redirects', async () => {
    const data = await seedWithCookie(Date.now() + 99);
    const res = await request(app)
      .post(`/projects/${data.project._id.toString()}/delete`)
      .set('Cookie', data.cookie);
    expect(res.status).toBe(302);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM SUBMISSIONS — profile
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — profile form submissions', () => {
  it('POST /profile/update with valid data redirects with success', async () => {
    const { cookie, user } = await seedWithCookie();
    const res = await request(app)
      .post('/profile/update')
      .set('Cookie', cookie)
      .send(`name=Updated+Name&email=${encodeURIComponent(user.email)}`)
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/profile');
  });

  it('POST /profile/update with short name redirects with error', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app)
      .post('/profile/update')
      .set('Cookie', cookie)
      .send('name=X&email=valid@test.com')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('error');
  });

  it('POST /profile/update with invalid email redirects with error', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app)
      .post('/profile/update')
      .set('Cookie', cookie)
      .send('name=Valid+Name&email=notanemail')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('error');
  });

  it('POST /profile/update with duplicate email redirects with error', async () => {
    const other = await User.create({ name: 'Other', email: `otherprof${Date.now()}@test.com`, password: 'password123' });
    const { cookie } = await seedWithCookie();
    const res = await request(app)
      .post('/profile/update')
      .set('Cookie', cookie)
      .send(`name=Valid+Name&email=${encodeURIComponent(other.email)}`)
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('error');
  });

  it('POST /profile/change-password route removed — returns 404', async () => {
    const { cookie } = await seedWithCookie();
    const res = await request(app)
      .post('/profile/change-password')
      .set('Cookie', cookie)
      .send('currentPassword=password123&newPassword=newpass123&confirmPassword=newpass123')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    // Route removed — password changes now use email reset flow only
    expect([302, 404]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — comment deletion', () => {
  it('POST /comments/:id/delete redirects back to task', async () => {
    const { cookie, task, user } = await seedWithCookie();
    const comment = await Comment.create({
      task: task._id,
      author: user._id,
      content: 'A test comment',
    });
    const res = await request(app)
      .post(`/comments/${comment._id.toString()}/delete`)
      .set('Cookie', cookie)
      .send(`taskId=${task._id.toString()}`)
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRED/INVALID TOKEN
// ─────────────────────────────────────────────────────────────────────────────
describe('Web routes — invalid cookie handling', () => {
  it('GET /dashboard with invalid token clears cookie and redirects to /login', async () => {
    const res = await request(app)
      .get('/dashboard')
      .set('Cookie', 'tf_token=invalidtoken');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });

  it('GET /logout with invalid token still redirects to /login', async () => {
    const res = await request(app)
      .get('/logout')
      .set('Cookie', 'tf_token=invalid.token.here');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/login');
  });
});

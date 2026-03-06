import { Router, Request, Response, NextFunction } from 'express';
import authService from '@/services/auth.service';
import taskService from '@/services/task.service';
import projectService from '@/services/project.service';
import commentService from '@/services/comment.service';
import { getProjectReport, exportProjectCsv } from '@/controllers/project.controller';
import { exportTasksPdf, exportTasksCsv } from '@/controllers/upload.controller';
import { upload } from '@/config/multer';
import { verifyAccessToken } from '@/utils/tokenUtils';
import User from '@/models/User.model';
import Task from '@/models/Task.model';

const router = Router();


function getTokenFromCookie(req: Request): string | null {
  return (req.cookies?.tf_token as string) ?? null;
}

interface WebUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function getWebUser(req: Request): WebUser | null {
  const token = getTokenFromCookie(req);
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    return { id: payload.userId, name: '', email: '', role: payload.role };
  } catch {
    return null;
  }
}

async function resolveWebUser(req: Request): Promise<WebUser | null> {
  const token = getTokenFromCookie(req);
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    const dbUser = await User.findById(payload.userId).select('name email role').lean();
    if (!dbUser) return null;
    return {
      id: payload.userId,
      name: (dbUser as { name?: string }).name ?? '',
      email: (dbUser as { email?: string }).email ?? '',
      role: payload.role,
    };
  } catch {
    return null;
  }
}

function renderWithLayout(
  res: Response,
  view: string,
  locals: Record<string, unknown> = {},
  statusCode = 200,
) {
  let layoutType = 'app';
  if (view === 'index') layoutType = 'public';
  else if (view.startsWith('auth/')) layoutType = 'auth';

  let currentPath = '/';
  if (view === 'dashboard') currentPath = '/dashboard';
  else if (view.startsWith('tasks')) currentPath = '/tasks';
  else if (view.startsWith('projects')) currentPath = '/projects';

  res.status(statusCode).render(view, { layoutType, currentPath, ...locals });
}

function requireWebAuth(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromCookie(req);
  if (!token) {
    return res.redirect('/login?next=' + encodeURIComponent(req.url));
  }
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.clearCookie('tf_token');
    return res.redirect('/login');
  }
}


router.get('/', (req: Request, res: Response) => {
  const user = getWebUser(req);
  if (user) return res.redirect('/dashboard');
  renderWithLayout(res, 'index', { title: 'Welcome', user: null });
});


router.get('/login', (req: Request, res: Response) => {
  if (getWebUser(req)) return res.redirect('/dashboard');
  renderWithLayout(res, 'auth/login', { title: 'Login', user: null });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  try {
    const { tokens } = await authService.login({ email, password });
    res.cookie('tf_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    res.redirect('/dashboard');
  } catch (err) {
    renderWithLayout(res, 'auth/login', {
      title: 'Login',
      user: null,
      error: (err as Error).message,
      formData: { email },
    });
  }
});

router.get('/signup', (req: Request, res: Response) => {
  if (getWebUser(req)) return res.redirect('/dashboard');
  renderWithLayout(res, 'auth/signup', { title: 'Sign Up', user: null });
});

router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };
  try {
    const { tokens } = await authService.signup({ name, email, password });
    res.cookie('tf_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    res.redirect('/dashboard');
  } catch (err) {
    renderWithLayout(res, 'auth/signup', {
      title: 'Sign Up',
      user: null,
      error: (err as Error).message,
      formData: { name, email },
    });
  }
});

router.get('/forgot-password', (_req: Request, res: Response) => {
  renderWithLayout(res, 'auth/forgot-password', { title: 'Forgot Password', user: null });
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  try {
    await authService.forgotPassword(email);
    renderWithLayout(res, 'auth/forgot-password', {
      title: 'Forgot Password',
      user: null,
      message: 'If this email is registered, you will receive a reset link shortly.',
    });
  } catch (err) {
    renderWithLayout(res, 'auth/forgot-password', {
      title: 'Forgot Password',
      user: null,
      error: (err as Error).message,
    });
  }
});

router.get('/reset-password', (_req: Request, res: Response) => {
  const { token } = _req.query as { token?: string };
  if (!token) {
    return res.redirect('/forgot-password');
  }
  renderWithLayout(res, 'auth/reset-password', { title: 'Reset Password', user: null, token });
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password, confirmPassword } = req.body as {
    token: string;
    password: string;
    confirmPassword: string;
  };
  try {
    if (!token) throw new Error('Reset token is missing');
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');
    if (password !== confirmPassword) throw new Error('Passwords do not match');
    await authService.resetPassword(token, password);
    renderWithLayout(res, 'auth/login', {
      title: 'Login',
      user: null,
      message: 'Password reset successful. Please sign in with your new password.',
    });
  } catch (err) {
    renderWithLayout(res, 'auth/reset-password', {
      title: 'Reset Password',
      user: null,
      token: token ?? '',
      error: (err as Error).message,
    });
  }
});

router.get('/logout', (req: Request, res: Response) => {
  res.clearCookie('tf_token');
  res.redirect('/login');
});


router.get('/dashboard', requireWebAuth, async (req: Request, res: Response) => {
  const [user, result, allResult] = await Promise.all([
    resolveWebUser(req),
    taskService.findAll({ page: 1, limit: 5 }),
    taskService.findAll({ page: 1, limit: 1000 }),
  ]);
  const allTasks = allResult.data;

  const now = new Date();
  const stats = {
    total: allTasks.length,
    inProgress: allTasks.filter((t) => t.status === 'in-progress').length,
    done: allTasks.filter((t) => t.status === 'done').length,
    overdue: allTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done').length,
  };

  renderWithLayout(res, 'dashboard', {
    title: 'Dashboard',
    activePage: 'dashboard',
    user,
    tasks: result.data,
    stats,
    topbarAction: '<a href="/tasks/new" class="btn btn-primary btn-sm">+ New Task</a>',
  });
});


router.get('/tasks', requireWebAuth, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = 12;
  const status = req.query.status as string | undefined;
  const priority = req.query.priority as string | undefined;
  const search = (req.query.search as string | undefined)?.trim() || undefined;

  const [user, result] = await Promise.all([
    resolveWebUser(req),
    taskService.findAll({ page, limit, status, priority, search }),
  ]);

  renderWithLayout(res, 'tasks/index', {
    title: `Tasks (${result.total})`,
    activePage: 'tasks',
    user,
    tasks: result.data,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
    },
    query: { status, priority, search },
    topbarAction: '<a href="/tasks/new" class="btn btn-primary btn-sm">+ New Task</a>',
  });
});

router.get('/tasks/new', requireWebAuth, async (req: Request, res: Response) => {
  const [user, projectsResult] = await Promise.all([
    resolveWebUser(req),
    projectService.findAll().catch(() => []),
  ]);

  renderWithLayout(res, 'tasks/new', {
    title: 'New Task',
    activePage: 'tasks',
    user,
    projects: projectsResult,
    preselectedProject: (req.query.project as string) || '',
  });
});

router.post('/tasks', requireWebAuth, async (req: Request, res: Response) => {
  const user = (await resolveWebUser(req))!;
  const { title, description, status, priority, project, dueDate, tags } = req.body as Record<string, string>;
  try {
    if (!project) throw new Error('Please select a project for the task');
    const tagsArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    await taskService.create(
      {
        title,
        description: description || '',
        status: (status || 'todo') as 'todo',
        priority: (priority || 'medium') as 'medium',
        project,
        dueDate: dueDate || undefined,
        tags: tagsArray,
        assignee: user.id,
      },
      user.id,
    );
    res.redirect('/tasks');
  } catch (err) {
    renderWithLayout(res, 'tasks/new', {
      title: 'New Task',
      activePage: 'tasks',
      user,
      error: (err as Error).message,
      formData: req.body,
      projects: [],
    });
  }
});

router.get('/tasks/:id', requireWebAuth, async (req: Request, res: Response) => {
  try {
    const [user, task, commentsResult] = await Promise.all([
      resolveWebUser(req),
      taskService.findById(req.params.id),
      commentService.findByTask(req.params.id),
    ]);

    renderWithLayout(res, 'tasks/show', {
      title: task.title,
      activePage: 'tasks',
      user,
      task,
      comments: commentsResult,
    });
  } catch {
    res.redirect('/tasks');
  }
});

router.post('/tasks/:id/update', requireWebAuth, async (req: Request, res: Response) => {
  const { title, description } = req.body as { title?: string; description?: string };
  try {
    const update: Record<string, string> = {};
    if (title && title.trim()) update.title = title.trim();
    if (description !== undefined) update.description = description.trim();
    await taskService.update(req.params.id, update);
  } catch {
    // ignore
  }
  res.redirect('/tasks/' + req.params.id);
});

router.post('/tasks/:id/status', requireWebAuth, async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  try {
    await taskService.update(req.params.id, { status });
  } catch {
    // ignore
  }
  const referer = req.get('Referer') || '/tasks/' + req.params.id;
  res.redirect(referer);
});

router.post('/tasks/:id/attachments', requireWebAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (task && req.file) {
      task.attachments.push({ filename: req.file.originalname, path: req.file.path, size: req.file.size });
      await task.save();
    }
  } catch { /* ignore */ }
  res.redirect('/tasks/' + req.params.id);
});

router.get('/tasks/export/pdf', requireWebAuth, exportTasksPdf);
router.get('/tasks/export/csv', requireWebAuth, exportTasksCsv);

router.post('/tasks/:id/comments', requireWebAuth, async (req: Request, res: Response) => {
  const user = (await resolveWebUser(req))!;
  const { body } = req.body as { body: string };
  try {
    await commentService.create(req.params.id, user.id, { content: body });
  } catch {
    // ignore
  }
  res.redirect('/tasks/' + req.params.id);
});

router.post('/tasks/:id/delete', requireWebAuth, async (req: Request, res: Response) => {
  try {
    await taskService.softDelete(req.params.id);
  } catch {
    // ignore
  }
  res.redirect('/tasks');
});


router.get('/projects', requireWebAuth, async (req: Request, res: Response) => {
  const [user, projects] = await Promise.all([
    resolveWebUser(req),
    projectService.findAll().catch(() => []),
  ]);

  renderWithLayout(res, 'projects/index', {
    title: 'Projects',
    activePage: 'projects',
    user,
    projects,
    topbarAction: '<a href="/projects/new" class="btn btn-primary btn-sm">+ New Project</a>',
  });
});

router.get('/projects/new', requireWebAuth, async (req: Request, res: Response) => {
  const user = await resolveWebUser(req);
  renderWithLayout(res, 'projects/new', {
    title: 'New Project',
    activePage: 'projects',
    user,
  });
});

router.post('/projects', requireWebAuth, async (req: Request, res: Response) => {
  const user = (await resolveWebUser(req))!;
  const { name, description } = req.body as { name: string; description: string };
  try {
    await projectService.create({ name, description }, user.id);
    res.redirect('/projects');
  } catch (err) {
    renderWithLayout(res, 'projects/new', {
      title: 'New Project',
      activePage: 'projects',
      user,
      error: (err as Error).message,
    });
  }
});

router.post('/projects/:id/delete', requireWebAuth, async (req: Request, res: Response) => {
  try {
    await projectService.deleteProject(req.params.id, req.userId!);
    res.redirect('/projects');
  } catch (err) {
    res.redirect('/projects/' + req.params.id + '?error=' + encodeURIComponent((err as Error).message));
  }
});

router.get('/projects/:id/report', requireWebAuth, getProjectReport);

router.get('/projects/:id/export', requireWebAuth, exportProjectCsv);

router.post('/projects/:id/members', requireWebAuth, async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  try {
    await projectService.addMember(req.params.id, email, req.userId!);
    res.redirect('/projects/' + req.params.id + '?success=Member+added');
  } catch (err) {
    res.redirect('/projects/' + req.params.id + '?error=' + encodeURIComponent((err as Error).message));
  }
});

router.post('/projects/:id/members/:memberId/remove', requireWebAuth, async (req: Request, res: Response) => {
  try {
    await projectService.removeMember(req.params.id, req.params.memberId, req.userId!);
    res.redirect('/projects/' + req.params.id);
  } catch (err) {
    res.redirect('/projects/' + req.params.id + '?error=' + encodeURIComponent((err as Error).message));
  }
});

router.post('/comments/:id/delete', requireWebAuth, async (req: Request, res: Response) => {
  const { taskId } = req.body as { taskId: string };
  try {
    await commentService.deleteComment(req.params.id, req.userId!);
  } catch {
    // eslint-disable-next-line no-empty
  }
  res.redirect('/tasks/' + taskId);
});

router.get('/projects/:id', requireWebAuth, async (req: Request, res: Response) => {
  try {
    const [user, result, project] = await Promise.all([
      resolveWebUser(req),
      projectService.getProjectTasks(req.params.id, 1, 50),
      projectService.findById(req.params.id),
    ]);

    const flashSuccess = req.query.success as string | undefined;
    const flashError = req.query.error as string | undefined;

    renderWithLayout(res, 'projects/show', {
      title: project.name,
      activePage: 'projects',
      user,
      project,
      tasks: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      },
      flash: flashSuccess
        ? { type: 'success', message: flashSuccess }
        : flashError
        ? { type: 'error', message: flashError }
        : undefined,
    });
  } catch {
    res.redirect('/projects');
  }
});

export default router;

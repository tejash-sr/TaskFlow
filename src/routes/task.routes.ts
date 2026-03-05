import { Router } from 'express';
import {
  createTask,
  listTasks,
  listTasksCursor,
  getTask,
  updateTask,
  deleteTask,
} from '@/controllers/task.controller';
import { addComment, listComments } from '@/controllers/comment.controller';
import {
  uploadAttachment,
  downloadAttachment,
  exportTasksPdf,
  exportTasksCsv,
} from '@/controllers/upload.controller';
import { isAuth } from '@/middleware/auth.middleware';
import { upload } from '@/config/multer';
import { validate } from '@/middleware/validate.middleware';
import {
  createTaskValidation,
  updateTaskValidation,
  mongoIdParam,
  paginationQuery,
  createCommentValidation,
} from '@/validation/rules';

const router = Router();

router.use(isAuth);

/**
 * @openapi
 * /tasks/export/pdf:
 *   get:
 *     tags: [Tasks]
 *     summary: Export all tasks as a PDF report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 */
router.get('/export/pdf', exportTasksPdf);

/**
 * @openapi
 * /tasks/export/csv:
 *   get:
 *     tags: [Tasks]
 *     summary: Export all tasks as CSV
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema: { type: string }
 */
router.get('/export/csv', exportTasksCsv);

/**
 * @openapi
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, example: Fix login bug }
 *               description: { type: string }
 *               assignee: { type: string, example: 64abc123 }
 *               project: { type: string, example: 64abc456 }
 *               priority: { type: string, enum: [low, medium, high, critical] }
 *               dueDate: { type: string, format: date-time }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Task' }
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks with pagination and filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [todo, in-progress, review, done] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, critical] }
 *     responses:
 *       200:
 *         description: Paginated task list
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedTasks' }
 */
router.post('/', validate(createTaskValidation), createTask);
router.get('/', validate(paginationQuery), listTasks);

/**
 * @openapi
 * /tasks/cursor:
 *   get:
 *     tags: [Tasks]
 *     summary: Cursor-based paginated task list (for infinite scroll)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Opaque cursor from previous response nextCursor
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Cursor-paginated tasks with nextCursor and hasMore
 */
router.get('/cursor', listTasksCursor);

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a task by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Task data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Task' }
 *       404:
 *         description: Task not found
 *   put:
 *     tags: [Tasks]
 *     summary: Update a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               status: { type: string, enum: [todo, in-progress, review, done] }
 *               priority: { type: string, enum: [low, medium, high, critical] }
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Task' }
 *   delete:
 *     tags: [Tasks]
 *     summary: Soft-delete a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Task deleted
 */
router.get('/:id', validate(mongoIdParam), getTask);
router.put('/:id', validate(updateTaskValidation), updateTask);
router.delete('/:id', validate(mongoIdParam), deleteTask);

/**
 * @openapi
 * /tasks/{id}/attachments:
 *   post:
 *     tags: [Tasks]
 *     summary: Upload a file attachment to a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: File uploaded successfully
 */
router.post('/:id/attachments', validate(mongoIdParam), upload.single('file'), uploadAttachment);
router.get('/:id/attachments/:filename', validate(mongoIdParam), downloadAttachment);

/**
 * @openapi
 * /tasks/{id}/comments:
 *   post:
 *     tags: [Comments]
 *     summary: Add a comment to a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, example: Looking good! }
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Comment' }
 *   get:
 *     tags: [Comments]
 *     summary: List comments for a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Comment' }
 */
router.post('/:id/comments', validate(createCommentValidation), addComment);
router.get('/:id/comments', validate(mongoIdParam), listComments);

export default router;

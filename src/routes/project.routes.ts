import { Router } from 'express';
import {
  createProject,
  getProjectTasks,
  getProjectReport,
  exportProjectCsv,
} from '@/controllers/project.controller';
import { isAuth } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { createProjectValidation, mongoIdParam, paginationQuery } from '@/validation/rules';

const router = Router();

router.use(isAuth);

/**
 * @openapi
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: TaskFlow MVP }
 *               description: { type: string, example: Main project }
 *               members: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Project created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Project' }
 */
router.post('/', validate(createProjectValidation), createProject);

/**
 * @openapi
 * /projects/{id}/tasks:
 *   get:
 *     tags: [Projects]
 *     summary: Get paginated tasks for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated task list for the project
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedTasks' }
 *       404:
 *         description: Project not found
 */
router.get('/:id/tasks', validate([...mongoIdParam, ...paginationQuery]), getProjectTasks);

/**
 * @openapi
 * /projects/{id}/report:
 *   get:
 *     tags: [Projects]
 *     summary: Generate a PDF report for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Project report PDF
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       404:
 *         description: Project not found
 */
router.get('/:id/report', validate(mongoIdParam), getProjectReport);

/**
 * @openapi
 * /projects/{id}/export:
 *   get:
 *     tags: [Projects]
 *     summary: Export project tasks as CSV
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv], default: csv }
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema: { type: string }
 */
router.get('/:id/export', validate(mongoIdParam), exportProjectCsv);

export default router;

import { body, param, query } from 'express-validator';


export const signupValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

export const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

export const refreshValidation = [
  body('refreshToken')
    .notEmpty().withMessage('refreshToken is required'),
];

export const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
];

export const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

export const resendVerificationValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
];


export const createTaskValidation = [
  body('title')
    .trim()
    .escape()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 100 }).withMessage('Title must be 3–100 characters'),
  body('description')
    .trim()
    .customSanitizer((v: string) => v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]+>/g, ''))
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 2000 }).withMessage('Description must not exceed 2000 characters'),
  body('project')
    .notEmpty().withMessage('Project ID is required')
    .isMongoId().withMessage('Invalid project ID'),
  body('assignee')
    .notEmpty().withMessage('Assignee ID is required')
    .isMongoId().withMessage('Invalid assignee ID'),
  body('status')
    .optional()
    .isIn(['todo', 'in-progress', 'review', 'done'])
    .withMessage('Invalid status value'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority value'),
  body('dueDate')
    .optional()
    .isISO8601().withMessage('dueDate must be a valid ISO date')
    .custom((value: string) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Due date must be in the future');
      }
      return true;
    }),
  body('tags')
    .optional()
    .isArray({ max: 10 }).withMessage('Tags must not exceed 10 items'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 30 }).withMessage('Each tag must not exceed 30 characters'),
];

export const updateTaskValidation = [
  param('id').isMongoId().withMessage('Invalid task ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('Title must be 3–100 characters'),
  body('status')
    .optional()
    .isIn(['todo', 'in-progress', 'review', 'done'])
    .withMessage('Invalid status value'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority value'),
];

export const mongoIdParam = [
  param('id').isMongoId().withMessage('Invalid ID format'),
];

export const paginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be 1–100'),
];


export const createProjectValidation = [
  body('name')
    .trim()
    .escape()
    .notEmpty().withMessage('Project name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('description')
    .trim()
    .customSanitizer((v: string) => (v || '').replace(/<[^>]+>/g, ''))
    .notEmpty().withMessage('Project description is required')
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
];


export const createCommentValidation = [
  param('id').isMongoId().withMessage('Invalid task ID'),
  // Accept either 'content' (REST API) or 'body' (spec wording) — one must be present
  body('content')
    .if(body('body').not().exists())
    .trim()
    .notEmpty().withMessage('Comment content is required')
    .isLength({ min: 1, max: 2000 }).withMessage('Comment must be 1–2000 characters'),
  body('body')
    .if(body('content').not().exists())
    .trim()
    .notEmpty().withMessage('Comment body is required')
    .isLength({ min: 1, max: 2000 }).withMessage('Comment must be 1–2000 characters'),
];

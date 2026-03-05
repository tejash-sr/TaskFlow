import { Router, Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { runDailyDigest } from '@/services/digest.service';
import { isAuth, isAdmin } from '@/middleware/auth.middleware';

const router = Router();

/**
 * @openapi
 * /digest/trigger:
 *   post:
 *     tags: [Admin]
 *     summary: Manually trigger the daily overdue task digest (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Digest queued for all users with overdue tasks
 *       403:
 *         description: Admin access required
 */
router.post('/trigger', isAuth, isAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const entries = await runDailyDigest();
  res.status(200).json({
    status: 'success',
    message: `Daily digest enqueued for ${entries.length} user(s)`,
    data: entries,
  });
}));

export default router;

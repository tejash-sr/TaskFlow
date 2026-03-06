import Task from '@/models/Task.model';
import { enqueueEmail } from '@/queues/emailQueue';

export interface DigestEntry {
  userId: string;
  name: string;
  email: string;
  overdueCount: number;
}

export async function getUsersWithOverdueTasks(): Promise<DigestEntry[]> {
  const overdueTasks = await Task.find({
    dueDate: { $lt: new Date() },
    status: { $ne: 'done' },
    deletedAt: { $exists: false },
  }).populate<{ assignee: { _id: { toString(): string }; name: string; email: string } }>(
    'assignee',
    'name email',
  );

  const map = new Map<string, DigestEntry>();

  for (const task of overdueTasks) {
    const a = task.assignee;
    if (!a) continue;
    const uid = a._id.toString();
    const existing = map.get(uid);
    if (existing) {
      existing.overdueCount += 1;
    } else {
      map.set(uid, {
        userId: uid,
        name: a.name,
        email: a.email,
        overdueCount: 1,
      });
    }
  }

  return Array.from(map.values());
}

export async function runDailyDigest(): Promise<DigestEntry[]> {
  const entries = await getUsersWithOverdueTasks();

  for (const entry of entries) {
    void enqueueEmail({
      type: 'dailyDigest',
      to: entry.email,
      name: entry.name,
      overdueCount: entry.overdueCount,
    }).catch(() => {});
  }

  return entries;
}

if (require.main === module) {
  void runDailyDigest()
    .then((entries) => {
      process.stdout.write(`Daily digest sent to ${entries.length} user(s)\n`);
      process.exit(0);
    })
    .catch((err: Error) => {
      process.stderr.write(`Daily digest failed: ${err.message}\n`);
      process.exit(1);
    });
}

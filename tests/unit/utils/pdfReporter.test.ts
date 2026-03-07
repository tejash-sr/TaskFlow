import { generateTaskReportCsv } from '@/utils/pdfReporter';
import { ITask } from '@/types/models.types';
import { Types } from 'mongoose';

function makeTask(overrides: Partial<ITask> = {}): ITask {
  return {
    _id: new Types.ObjectId(),
    title: 'Test Task',
    description: 'A test task',
    status: 'todo',
    priority: 'medium',
    assignee: new Types.ObjectId() as unknown as ITask['assignee'],
    project: new Types.ObjectId() as unknown as ITask['project'],
    tags: [],
    attachments: [],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    ...overrides,
  } as unknown as ITask;
}

describe('pdfReporter utilities', () => {
  describe('generateTaskReportCsv', () => {
    it('generates correct header row', async () => {
      const csv = await generateTaskReportCsv([]);
      expect(csv).toContain('id,title,status,priority');
    });

    it('produces one row per task plus header', async () => {
      const tasks = [makeTask(), makeTask()];
      const csv = await generateTaskReportCsv(tasks);
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(3); // header + 2 rows
    });

    it('escapes double quotes in title', async () => {
      const task = makeTask({ title: 'Fix "the" bug' });
      const csv = await generateTaskReportCsv([task]);
      expect(csv).toContain('"Fix ""the"" bug"');
    });

    it('formats ISO dates correctly', async () => {
      const dueDate = new Date('2024-06-15');
      const task = makeTask({ dueDate });
      const csv = await generateTaskReportCsv([task]);
      expect(csv).toContain('2024-06-15');
    });

    it('leaves due date empty when not set', async () => {
      const task = makeTask({ dueDate: undefined });
      const csv = await generateTaskReportCsv([task]);
      const lines = csv.split('\n');
      const dataLine = lines[1];
      // 5th comma-separated field (index 4) should be empty
      const fields = dataLine.split(',');
      expect(fields[4]).toBe('');
    });

    it('handles tasks with all status values', async () => {
      const statuses: ITask['status'][] = ['todo', 'in-progress', 'review', 'done'];
      const tasks = statuses.map((status) => makeTask({ status }));
      const csv = await generateTaskReportCsv(tasks);
      expect(csv).toContain('todo');
      expect(csv).toContain('in-progress');
      expect(csv).toContain('review');
      expect(csv).toContain('done');
    });
  });
});

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';

const mockRequest = () => ({} as Request);
const mockResponse = () => ({} as Response);

describe('asyncHandler', () => {
  it('calls the handler and does not invoke next on success', async () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn() as NextFunction;
    const handler = async (_req: Request, _res: Response, _next: NextFunction) => {};

    await asyncHandler(handler)(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('passes the error to next when the handler rejects', async () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn() as NextFunction;
    const error = new Error('Async failure');
    const handler = async () => {
      throw error;
    };

    await asyncHandler(handler)(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('passes resolved handler arguments through correctly', async () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn() as NextFunction;
    const receivedArgs: unknown[] = [];

    const handler = async (r: Request, s: Response, n: NextFunction) => {
      receivedArgs.push(r, s, n);
    };

    await asyncHandler(handler)(req, res, next);

    expect(receivedArgs[0]).toBe(req);
    expect(receivedArgs[1]).toBe(res);
    expect(receivedArgs[2]).toBe(next);
  });
});

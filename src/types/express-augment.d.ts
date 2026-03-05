declare namespace Express {
  interface Request {
    userId?: string;
    userRole?: string;
    requestId?: string;
  }
}

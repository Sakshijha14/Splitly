// Turns any error thrown in a route into a JSON response with the right status code.
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Throw this from a route to send a specific status and message, e.g. new AppError(404, 'Group not found'). */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Express 4 doesn't catch errors from async functions, so every async route is wrapped in this. */
export function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
  } else if (err instanceof ZodError) {
    // Invalid input, e.g. a bad email. Send back the first problem found.
    res.status(400).json({ error: err.issues[0].message });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
}

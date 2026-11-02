import 'server-only';
import { DomainError, type ErrorCategory } from '@nestwise/domain/shared';
import { unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';

const STATUS: Record<ErrorCategory, number> = {
  invalid: 422,
  not_found: 404,
  not_allowed: 403,
  conflict: 409,
  not_signed_in: 401,
};

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/**
 * One mapper for every route: domain error category → HTTP status; bad shape → 400; anything else → 500, logged.
 * Next.js always passes `context` ({ params }); it is optional here so tests can call routes without params.
 */
export function withApiErrors<C = unknown>(handler: Handler<C>): (request: Request, context?: C) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context as C);
    } catch (error) {
      unstable_rethrow(error); // Next.js control flow (prerender bail-outs, redirects) is not an API error
      if (error instanceof DomainError) {
        return Response.json({ error: { code: error.name, message: error.message } }, { status: STATUS[error.category] });
      }
      if (error instanceof ZodError || error instanceof SyntaxError) {
        return Response.json({ error: { code: 'BadRequest', message: 'The request is not in the expected shape' } }, { status: 400 });
      }
      console.error(error);
      return Response.json({ error: { code: 'ServerError', message: 'Something went wrong' } }, { status: 500 });
    }
  };
}

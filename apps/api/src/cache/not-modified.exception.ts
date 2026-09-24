import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * "304 Not Modified" for the ETag-cached GET endpoints (the client's `If-None-Match` matches the cached copy).
 *
 * Thrown rather than written with `res.status(304).end()`: those routes use `@Res({ passthrough: true })`, so
 * Nest still sends the handler's return value afterwards — on an already-ended response, which threw
 * `ERR_HTTP_HEADERS_SENT` on every revalidation. Thrown, Nest's exception layer sends the one response, and
 * Express drops the body for a 304.
 */
export class NotModifiedException extends HttpException {
  constructor() {
    super("", HttpStatus.NOT_MODIFIED);
  }
}

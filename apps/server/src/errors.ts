/** An error with an HTTP status and a message that is safe to show to the player. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const badRequest = (message: string, code = "bad_request") => new HttpError(400, code, message);
export const unauthorized = (message = "Sign in to do that.") => new HttpError(401, "unauthorized", message);
export const forbidden = (message: string) => new HttpError(403, "forbidden", message);
/** Also used for things the player doesn't own, so ids of other players' brutes reveal nothing. */
export const notFound = (message = "That doesn't exist.") => new HttpError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") => new HttpError(409, code, message);
export const tooMany = (message: string) => new HttpError(429, "rate_limited", message);

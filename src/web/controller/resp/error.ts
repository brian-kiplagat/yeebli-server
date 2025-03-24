import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

const serveNotFound = (c: Context) => {
  return c.json({ error: getReasonPhrase(StatusCodes.NOT_FOUND) }, <ContentfulStatusCode>StatusCodes.NOT_FOUND);
};

const serveBadRequest = (c: Context, message: string) => {
  return c.json({ error: message }, <ContentfulStatusCode>StatusCodes.BAD_REQUEST);
};

const serveUnprocessableEntity = (c: Context, message: string) => {
  return c.json({ error: message }, <ContentfulStatusCode>StatusCodes.UNPROCESSABLE_ENTITY);
};

const serveUnauthorized = (c: Context) => {
  return c.json({ error: getReasonPhrase(StatusCodes.UNAUTHORIZED) }, <ContentfulStatusCode>StatusCodes.UNAUTHORIZED);
};

const serveInternalServerError = (c: Context, error: any) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, <ContentfulStatusCode>error.status);
  }

  return c.json({ error: error }, <ContentfulStatusCode>StatusCodes.INTERNAL_SERVER_ERROR);
};

const serveError = (c: Context, status: StatusCodes, message: string) => {
  return c.json({ error: message }, <ContentfulStatusCode>status);
};

const ERRORS = {
  USER_EXISTS: 'User already exists',
  USER_NOT_FOUND: 'User not found',
  INVALID_TOKEN: 'Ops, your code is invalid, please try again',
  LEAD_NOT_FOUND: 'Ops, this lead does not exist, please check',
  EVENT_NOT_FOUND: 'Ops, this event does not exist, please check',
  ASSET_NOT_FOUND: 'Ops, we could not find the associated asset for this event',
  NOT_ALLOWED: 'Ops, you are not allowed to do this action.',
  EVENT_HAS_LEADS_CONNECTED:
    'Event has leads connected, cannot delete because there are leads assigned to this event, please cancel event and delete all leads associated with this particular event',
  INVALID_STATE: 'Invalid state parameter. The state parameter does not match the expected value.',
};

export {
  ERRORS,
  serveBadRequest,
  serveError,
  serveInternalServerError,
  serveNotFound,
  serveUnauthorized,
  serveUnprocessableEntity,
};

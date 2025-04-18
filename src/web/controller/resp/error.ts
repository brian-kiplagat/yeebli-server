import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

const serveNotFound = (c: Context, message: string) => {
  return c.json({ error: message }, <ContentfulStatusCode>StatusCodes.NOT_FOUND);
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
  MEMBERSHIP_REQUIRED: 'Membership is required. Please add at least one membership to the event',
  INVALID_USER_ID: 'Ops, we could not find the user you are looking for. Confirm the user id and try again.',
  TEAM_NOT_FOUND: 'Ops, we could not find the team you are looking for. Confirm the team id and try again.',
  TEAM_MEMBER_NOT_FOUND: 'Ops, seem you are not a member of this team. Confirm that you have access to this team and try again.',
  MEMBERSHIP_NOT_ACTIVE: 'This lead has not paid for the membership',
  EVENT_ALREADY_CANCELLED: 'This event has already been cancelled',
  SCHEDULED_TIME_REQUIRED: 'Scheduled time is required for scheduled callbacks',
  CALLBACK_ALREADY_EXISTS: 'You have already scheduled a callback of this type for this event',
  SUBSCRIPTION_NOT_FOUND: "Subscription not found. Nothing left to cancel.",
  PRODUCT_ID_NOT_FOUND: 'Product not found. Please check the product id',
  CALLBACK_NOT_FOUND: 'Callback not found',
  MEMBERSHIP_LINKED_TO_EVENT: 'This membership is linked to an event. Deleting this will cause issues with existing contacts registered for the event. Please cancel the event first then try again.',
  CONTACT_NOT_FOUND: 'Ops, we cant find a contact with this email, please check if you have the correct details',
  STRIPE_ACCOUNT_ID_NOT_FOUND: 'The host has not configured payments, as a result you cannot initiate a payment.',
  LEAD_WITH_TOKEN_NOT_FOUND: 'Ops, we cant find a lead with this token, please check if you have the correct details',
  EVENT_DATE_ID_REQUIRED: 'If you invite a lead to an event, please also provide an event date.',
  BUSINESS_NOT_FOUND: 'Business not found, please check the business id',
  MEMBERSHIP_NOT_FOUND: 'Membership not found, please check the membership id',
  EVENT_DATE_NOT_FOUND: 'Event date not found',
  CANNOT_DELETE_LAST_DATE: 'Cannot delete the last remaining date for an event',
  NOT_FOUND: 'Ops, we could not find the resource you are looking for',
  BOOKING_FAILED: 'Failed to create booking',
  BOOKING_NOT_FOUND: 'Booking not found',
  GOOGLE_AUTH_USER_NOT_FOUND: 'Google authentication failed, user not found',
  AUTH_FAILED: 'Authentication failed',
  NO_AUTHORIZATION_CODE: 'No authorization code provided',
  USER_EXISTS: 'User already exists',
  USER_NOT_FOUND: 'User not found',
  INVALID_TOKEN: 'Ops, your code is invalid, please try again',
  LEAD_NOT_FOUND: 'Ops, this lead does not exist, please check',
  EVENT_NOT_FOUND: 'Ops, this event does not exist, please check',
  ASSET_NOT_FOUND: 'Ops, we could not find the associated asset for this event',
  NOT_ALLOWED: 'Ops, you are not allowed to do this action.',
  EVENT_HAS_LEADS_CONNECTED: 'This event has active leads connected. Please cancel the event first then try again.',
  INVALID_STATE: 'Invalid state parameter. The state parameter does not match the expected value.',
  EVENT_DATE_REQUIRED: 'Event date is required',
  STRIPE_CUSTOMER_ID_NOT_FOUND: 'Stripe customer ID not found',
  STRIPE_PAYMENT_METHOD_NOT_FOUND: 'Stripe payment method not found',
  AUTH_INVALID_PASSWORD: 'Ops, your old password is invalid, please check and try again',
  STRIPE_PAYMENT_METHOD_NOT_ACTIVE: 'Stripe payment method is not active',
  ASSET_LINKED_TO_EVENT: 'This asset has active leads tied to an event. Please cancel the event first then try again.',
  INVALID_DATE: 'Invalid date provided',
} as const;

const MAIL_CONTENT = {
  PASSWORD_CHANGED_IN_APP: {
    subject: 'Password Changed',
    title: 'Password Changed',
    subtitle: 'Your password has been changed successfully',
    body: 'Your password has been changed successfully. If this was not you, please contact support immediately.',
  },
  SUBSCRIPTION_CANCELLED: {
    subject: 'Your subscription has been cancelled',
    title: 'Subscription Cancelled',
    subtitle: "We're sorry to see you go!",
    body: "Your subscription has been successfully cancelled, and access to premium features will be revoked at the end of your billing period. We understand that circumstances change, but we'd love to have you back whenever you're ready. If you ever wish to return, you can easily re-subscribe from your account settings. In the meantime, if you have any questions or need assistance, feel free to reach out to our support team. Thank you for being a part of Yeebli, and we hope to see you again soon!",
  },
  SUBSCRIPTION_ENDED: {
    subject: 'Your subscription has ended',
    title: 'Subscription Ended',
    subtitle: 'Your access to premium features has expired',
    body: "Your subscription has officially ended, and your access to premium features has been discontinued. We hope you enjoyed your time with Yeebli! If you'd like to continue benefiting from exclusive features, you can renew your subscription anytime by visiting your account settings. We'd love to have you back, and if you need any help re-subscribing or have any questions, don't hesitate to contact our support team. Thank you for being part of our community!",
  },
  SUBSCRIPTION_TRIAL_ENDED: {
    subject: 'Your trial has ended',
    title: 'Trial Period Expired',
    subtitle: 'Upgrade now to continue enjoying premium features!',
    body: "Your trial period has ended, and access to premium features has been disabled. We hope you had a great experience exploring all that Yeebli has to offer! To continue using our premium features, you can upgrade to a full subscription at any time. Don't miss out on everything Yeebli provides—seamless access, exclusive tools, and an enhanced user experience. Visit your account now to subscribe and unlock the full potential of our platform!",
  },
  SUBSCRIPTION_PAYMENT_FAILED: {
    subject: 'Your subscription payment has failed',
    title: 'Payment Issue Detected',
    subtitle: 'We were unable to process your payment',
    body: 'We attempted to process your latest subscription payment, but unfortunately, it was unsuccessful. This could be due to an expired card, insufficient funds, or a payment authorization issue. Please check your payment details in your account settings and try again to avoid any disruption to your service. If you need assistance or have questions regarding this issue, our support team is available to help. Please update your payment method at your earliest convenience to continue enjoying Yeebli without interruption.',
  },
  SUBSCRIPTION_PAYMENT_SUCCEEDED: {
    subject: 'Your subscription payment was successful',
    title: 'Payment Received',
    subtitle: 'Your subscription is active!',
    body: "Good news! Your latest subscription payment was processed successfully, and your access to Yeebli's premium features remains active. Thank you for being a valued member of our community! If you ever need to review your billing details or update your payment method, you can do so in your account settings. We appreciate your continued support and hope you continue to enjoy all the features that Yeebli has to offer. If you have any questions, feel free to reach out to us.",
  },
  SUBSCRIPTION_TRIAL_STARTED: {
    subject: 'Your trial has started',
    title: 'Welcome to Your Free Trial!',
    subtitle: 'Enjoy premium features for a limited time',
    body: "Your free trial has officially begun! For the duration of your trial period, you'll have full access to all of Yeebli's premium features. We encourage you to explore and take advantage of everything our platform has to offer. When your trial ends, you'll have the opportunity to continue enjoying uninterrupted service by subscribing to one of our plans. If you have any questions during your trial, our support team is here to assist. Enjoy your experience with Yeebli!",
  },
};

export {
  ERRORS,
  MAIL_CONTENT,
  serveBadRequest,
  serveError,
  serveInternalServerError,
  serveNotFound,
  serveUnauthorized,
  serveUnprocessableEntity,
};

import { serveStatic } from "@hono/node-server/serve-static";
import { swaggerUI } from "@hono/swagger-ui";
import type { Worker } from "bullmq";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import env from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { connection } from "../lib/queue.js";
import { AdminRepository } from "../repository/admin.js";
import { AssetRepository } from "../repository/asset.js";
import { BookingRepository } from "../repository/booking.ts";
import { EventRepository } from "../repository/event.ts";
import { LeadRepository } from "../repository/lead.js";

import { SubscriptionRepository } from "../repository/subscription.js";
import { UserRepository } from "../repository/user.js";
import { AdminService } from "../service/admin.js";
import { AssetService } from "../service/asset.js";
import { BookingService } from "../service/booking.ts";
import { EventService } from "../service/event.ts";
import { GoogleService } from "../service/google.js";
import { HLSService } from "../service/hls.js";
import { LeadService } from "../service/lead.js";

import { S3Service } from "../service/s3.js";
import { StripeService } from "../service/stripe.js";
import { SubscriptionService } from "../service/subscription.js";
import { TurnstileService } from "../service/turnstile.js";
import { UserService } from "../service/user.js";
import { Tasker } from "../task/tasker.js";
import { AdminController } from "./controller/admin.js";
import { AssetController } from "./controller/asset.js";
import { AuthController } from "./controller/auth.js";
import { BookingController } from "./controller/booking.ts";
import { EventController } from "./controller/event.ts";
import { GoogleController } from "./controller/google.js";
import { HLSController } from "./controller/hls.js";
import { LeadController } from "./controller/lead.ts";

import {
  ERRORS,
  serveInternalServerError,
  serveNotFound,
} from "./controller/resp/error.js";
import { S3Controller } from "./controller/s3.js";
import { StripeController } from "./controller/stripe.js";
import { SubscriptionController } from "./controller/subscription.js";
import { adminCreateUserValidator } from "./validator/admin.ts";
import { assetQueryValidator } from "./validator/asset.ts";
import {
  cancelEventValidator,
  eventValidator,
  updateEventValidator,
} from "./validator/event.ts";
import { eventQueryValidator } from "./validator/event.ts";
import { hlsUploadValidator } from "./validator/hls.ts";
import {
  eventLinkValidator,
  externalFormValidator,
  leadUpgradeValidator,
  leadValidator,
  updateLeadValidator,
} from "./validator/lead.ts";
import {
  membershipQueryValidator,
  membershipValidator,
} from "./validator/membership.ts";
import { subscriptionRequestValidator } from "./validator/subscription.ts";
import {
  emailVerificationValidator,
  inAppResetPasswordValidator,
  loginValidator,
  registerTokenValidator,
  registrationValidator,
  requestResetPasswordValidator,
  resetPasswordValidator,
  updateUserDetailsValidator,
} from "./validator/user.js";
import { BusinessRepository } from "../repository/business.js";
import { BusinessService } from "../service/business.js";
import { BusinessController } from "./controller/business.js";
import {
  businessValidator,
  businessQueryValidator,
} from "./validator/business.js";
import { MembershipController } from "./controller/membership.ts";
import { MembershipRepository } from "../repository/membership.ts";
import { MembershipService } from "../service/membership.ts";
import { TeamRepository } from "../repository/team.js";
import { TeamService } from "../service/team.js";
import { TeamController } from "./controller/team.js";
import {
  createTeamValidator,
  inviteMemberValidator,
  teamQueryValidator,
} from "./validator/team.ts";

export class Server {
  private app: Hono;
  private worker?: Worker;
  private hlsWorker?: Worker;

  constructor(app: Hono) {
    this.app = app;
  }

  public configure() {
    // Index path
    this.app.get("/", (c) => {
      return c.text("Ok");
    });

    // Static files
    this.app.use("/static/*", serveStatic({ root: "./" }));

    // API Doc
    this.app.get("/doc", swaggerUI({ url: "/static/openapi.yaml" }));

    // Universal catchall
    this.app.notFound((c) => {
      return serveNotFound(c, ERRORS.NOT_FOUND);
    });

    // Error handling
    this.app.onError((err, c) => {
      return serveInternalServerError(c, err);
    });

    const api = this.app.basePath("/v1");

    // Setup repos
    const userRepo = new UserRepository();
    const leadRepo = new LeadRepository();
    const eventRepo = new EventRepository();
    const adminRepo = new AdminRepository();
    const assetRepo = new AssetRepository();
    const subscriptionRepo = new SubscriptionRepository();
    const teamRepo = new TeamRepository();

    const businessRepo = new BusinessRepository();

    // Setup services
    const s3Service = new S3Service();
    const turnstileService = new TurnstileService();
    const leadService = new LeadService(leadRepo);
    const eventService = new EventService(eventRepo, s3Service, leadService);
    const adminService = new AdminService(adminRepo);
    const bookingRepo = new BookingRepository();
    const membershipRepo = new MembershipRepository();
    const membershipService = new MembershipService(membershipRepo);
    const bookingService = new BookingService(bookingRepo);
    const assetService = new AssetService(assetRepo, s3Service);
    const hlsService = new HLSService(s3Service, assetService);
    const stripeService = new StripeService();
    const userService = new UserService(
      userRepo,
      stripeService,
      membershipService
    );
    const subscriptionService = new SubscriptionService(
      subscriptionRepo,
      stripeService,
      userService
    );
    const teamService = new TeamService(teamRepo, userService);

    const businessService = new BusinessService(
      businessRepo,
      s3Service,
      assetService,
      teamService
    );

    // Setup workers
    this.registerWorker(userService);

    // Setup controllers
    const authController = new AuthController(
      userService,
      businessService,
      s3Service,
      assetService,
      userRepo
    );
    const leadController = new LeadController(
      leadService,
      userService,
      eventService,
      turnstileService,
      membershipService,
      stripeService
    );
    const eventController = new EventController(
      eventService,
      userService,
      leadService
    );
    const adminController = new AdminController(
      adminService,
      userService,
      eventService,
      leadService,
      assetService
    );
    const s3Controller = new S3Controller(s3Service);
    const assetController = new AssetController(
      assetService,
      userService,
      eventService,
      leadService
    );
    const hlsController = new HLSController(hlsService, userService);
    const stripeController = new StripeController(
      stripeService,
      userService,
      subscriptionRepo,
      leadService
    );
    const subscriptionController = new SubscriptionController(
      subscriptionService,
      stripeService,
      userService
    );
    const bookingCtrl = new BookingController(bookingService);

    const businessController = new BusinessController(
      businessService,
      userService
    );
    const membershipController = new MembershipController(
      membershipService,
      userService
    );

    // Add team service and controller

    const teamController = new TeamController(teamService, userService);

    // Add Google service and controller
    const googleService = new GoogleService(userService, stripeService);
    const googleController = new GoogleController(
      googleService,
      s3Service,
      userRepo
    );

    // Register routes
    this.registerUserRoutes(api, authController, googleController);
    this.registerLeadRoutes(api, leadController);
    this.registerEventRoutes(api, eventController);
    this.registerAdminRoutes(api, adminController);
    this.registerS3Routes(api, s3Controller);
    this.registerAssetRoutes(api, assetController);
    this.registerHLSRoutes(api, hlsController);
    this.registerStripeRoutes(api, stripeController);
    this.registerSubscriptionRoutes(api, subscriptionController);
    this.registerBookingRoutes(api, bookingCtrl);
    this.registerBusinessRoutes(api, businessController);
    this.registerMembershipRoutes(api, membershipController);
    this.registerTeamRoutes(api, teamController);
  }

  private registerUserRoutes(
    api: Hono,
    authCtrl: AuthController,
    googleCtrl: GoogleController
  ) {
    const user = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    user.get("/me", authCheck, authCtrl.me);
    user.post("/login", loginValidator, authCtrl.login);
    user.post("/register", registrationValidator, authCtrl.register);
    user.post("/send-token", emailVerificationValidator, authCtrl.sendToken);
    user.post(
      "/verify-registration",
      registerTokenValidator,
      authCtrl.verifyRegistrationToken
    );
    user.post(
      "/request-reset-password",
      requestResetPasswordValidator,
      authCtrl.requestResetPassword
    );
    user.post(
      "/reset-password",
      resetPasswordValidator,
      authCtrl.resetPassword
    );
    user.post(
      "/reset-password-in-app",
      authCheck,
      inAppResetPasswordValidator,
      authCtrl.resetPasswordInApp
    );
    user.put(
      "/details",
      authCheck,
      updateUserDetailsValidator,
      authCtrl.updateUserDetails
    );

    // Add Google auth routes
    user.get("/auth/google", googleCtrl.initiateAuth);
    user.get("/auth/google/callback", googleCtrl.handleCallback);

    api.route("/user", user);
  }

  private registerLeadRoutes(api: Hono, leadCtrl: LeadController) {
    const lead = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    lead.get("/", authCheck, leadCtrl.getLeads);
    lead.get("/:id", authCheck, leadCtrl.getLead);
    lead.post("/", authCheck, leadValidator, leadCtrl.createLead);
    lead.post(
      "/lead-validate-event",
      eventLinkValidator,
      leadCtrl.validateEventLink
    );
    lead.post(
      "/lead-upgrade",
      authCheck,
      leadUpgradeValidator,
      leadCtrl.upgradeLead
    );
    lead.put("/:id", authCheck, updateLeadValidator, leadCtrl.updateLead);
    lead.delete("/:id", authCheck, leadCtrl.deleteLead);

    // New external form endpoint - no auth required
    lead.post(
      "/external-form",
      externalFormValidator,
      leadCtrl.handleExternalForm
    );

    api.route("/lead", lead);
  }

  private registerEventRoutes(api: Hono, eventCtrl: EventController) {
    const event = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    event.get("/", authCheck, eventQueryValidator, eventCtrl.getEvents);
    event.get("/:id", authCheck, eventCtrl.getEvent);
    event.get("/:id/dates", authCheck, eventCtrl.getEventDates);
    event.delete("/:id/dates/:dateId", authCheck, eventCtrl.deleteEventDate);
    event.post("/", authCheck, eventValidator, eventCtrl.createEvent);
    event.put("/:id", authCheck, updateEventValidator, eventCtrl.updateEvent);
    event.delete("/:id", authCheck, eventCtrl.deleteEvent);
    event.post(
      "/cancel",
      authCheck,
      cancelEventValidator,
      eventCtrl.cancelEvent
    );

    api.route("/event", event);
  }

  private registerAdminRoutes(api: Hono, adminCtrl: AdminController) {
    const admin = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    admin.get("/user/:id", authCheck, adminCtrl.getParticularUser);
    admin.put("/user/:id", authCheck, adminCtrl.updateParticularUser);
    admin.get("/users", authCheck, adminCtrl.getUsers);
    admin.post(
      "/user",
      authCheck,
      adminCreateUserValidator,
      adminCtrl.createUser
    );
    admin.get("/leads", authCheck, adminCtrl.getLeads);
    admin.get("/events", authCheck, adminCtrl.getEvents);
    admin.delete("/user/:id", authCheck, adminCtrl.deleteUser);

    api.route("/admin", admin);
  }

  private registerS3Routes(api: Hono, s3Ctrl: S3Controller) {
    const s3 = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    s3.post("/presigned-url", authCheck, s3Ctrl.generatePresignedUrl);
    api.route("/s3", s3);
  }

  private registerAssetRoutes(api: Hono, assetCtrl: AssetController) {
    const asset = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    asset.get("/", authCheck, assetQueryValidator, assetCtrl.getAssets);
    asset.get("/:id", authCheck, assetCtrl.getAsset);
    asset.post("/", authCheck, assetCtrl.createAsset);
    asset.put("/:id/rename", authCheck, assetCtrl.renameAsset);
    asset.delete("/:id", authCheck, assetCtrl.deleteAsset);

    api.route("/asset", asset);
  }

  private registerHLSRoutes(api: Hono, hlsCtrl: HLSController) {
    const hls = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    hls.post("/upload", authCheck, hlsUploadValidator, hlsCtrl.upload);

    api.route("/hls", hls);
  }

  private registerStripeRoutes(api: Hono, stripeCtrl: StripeController) {
    const stripe = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    // OAuth routes
    stripe.get("/connect/oauth", authCheck, stripeCtrl.initiateOAuth);
    stripe.get(
      "/connect/oauth/callback",
      authCheck,
      stripeCtrl.handleOAuthCallback
    );
    stripe.get("/list/payment/methods", authCheck, stripeCtrl.getCardDetails);

    // Webhook
    stripe.post("/webhook", stripeCtrl.handleWebhook);

    api.route("/stripe", stripe);
  }

  private registerSubscriptionRoutes(
    api: Hono,
    subscriptionCtrl: SubscriptionController
  ) {
    const subscription = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    subscription.get("/", authCheck, subscriptionCtrl.getSubscriptions);
    subscription.post(
      "/subscribe",
      authCheck,
      subscriptionRequestValidator,
      subscriptionCtrl.subscribe
    );
    subscription.delete("/", authCheck, subscriptionCtrl.cancelSubscription);

    api.route("/subscription", subscription);
  }

  private registerBookingRoutes(api: Hono, bookingCtrl: BookingController) {
    const booking = new Hono();

    booking.post("/", bookingCtrl.createBooking);
    booking.get("/lead/:lead_id", bookingCtrl.getBookingsByLead);

    api.route("/booking", booking);
  }

  private registerBusinessRoutes(api: Hono, businessCtrl: BusinessController) {
    const business = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    // Regular user endpoints
    business.get("/my", authCheck, businessCtrl.getMyBusiness);
    business.post(
      "/my",
      authCheck,
      businessValidator,
      businessCtrl.upsertBusiness
    );

    // Admin only endpoint
    business.get(
      "/",
      authCheck,
      businessQueryValidator,
      businessCtrl.getAllBusinesses
    );

    api.route("/business", business);
  }

  private registerMembershipRoutes(
    api: Hono,
    membershipCtrl: MembershipController
  ) {
    const membership = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    membership.get(
      "/",
      authCheck,
      membershipQueryValidator,
      membershipCtrl.getMemberships
    );
    membership.get("/:id", authCheck, membershipCtrl.getMembership);
    membership.post(
      "/",
      authCheck,
      membershipValidator,
      membershipCtrl.createMembership
    );
    membership.put(
      "/:id",
      authCheck,
      membershipValidator,
      membershipCtrl.updateMembership
    );
    membership.delete("/:id", authCheck, membershipCtrl.deleteMembership);

    api.route("/membership", membership);
  }

  private registerTeamRoutes(api: Hono, teamCtrl: TeamController) {
    const team = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    team.post("/create", authCheck, createTeamValidator, teamCtrl.createTeam);
    team.post(
      "/invite",
      authCheck,
      inviteMemberValidator,
      teamCtrl.inviteMember
    );
    team.get(
      "/invitations",
      authCheck,
      teamQueryValidator,
      teamCtrl.getTeamInvitations
    );
    team.get(
      "/my-invitations",
      authCheck,
      teamQueryValidator,
      teamCtrl.getMyInvitations
    );
    team.post("/invitations/:id/accept", teamCtrl.acceptInvitation);
    team.post("/invitations/:id/reject", teamCtrl.rejectInvitation);
    team.get("/:id/members", authCheck, teamCtrl.getTeamMembers);
    team.get("/my-team/members", authCheck, teamCtrl.getMyTeamMembers);

    api.route("/team", team);
  }

  private registerWorker(userService: UserService) {
    const tasker = new Tasker(userService);
    const worker = tasker.setup();
    if (worker.isRunning()) {
      logger.info("Worker is running");
    }
    this.worker = worker;
  }

  public async shutDownWorker() {
    await this.worker?.close();
    await this.hlsWorker?.close();
    await connection.quit();
  }
}

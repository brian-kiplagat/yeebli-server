import { serveStatic } from "@hono/node-server/serve-static";
import { swaggerUI } from "@hono/swagger-ui";
import type { Worker } from "bullmq";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import env from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { connection } from "../lib/queue.js";
import { UserRepository } from "../repository/user.js";
import { LeadRepository } from "../repository/lead.js";
import { UserService } from "../service/user.js";
import { LeadService } from "../service/lead.js";
import { Tasker } from "../task/tasker.js";
import { AuthController } from "./controller/auth.js";
import { LeadController } from "./controller/lead.ts";

import {
  serveInternalServerError,
  serveNotFound,
} from "./controller/resp/error.js";
import {
  emailVerificationValidator,
  loginValidator,
  registerTokenValidator,
  registrationValidator,
  requestResetPasswordValidator,
  resetPasswordValidator,
} from "./validator/user.js";
import { leadValidator } from "./validator/lead.ts";
import { EventController } from "./controller/event.ts";
import { EventRepository } from "../repository/event.ts";
import { EventService } from "../service/event.ts";
import { eventValidator } from "./validator/event.ts";



export class Server {
  private app: Hono;
  private worker?: Worker;

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
      return serveNotFound(c);
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

    // Setup services
    const userService = new UserService(userRepo);
    const leadService = new LeadService(leadRepo);
    const eventService = new EventService(eventRepo);

    // Setup worker
    this.registerWorker(userService);

    // Setup controllers
    const authController = new AuthController(userService);
    const leadController = new LeadController(leadService, userService);
    const eventController = new EventController(eventService, userService);

    // Register routes
    this.registerUserRoutes(api, authController);
    this.registerLeadRoutes(api, leadController);
    this.registerEventRoutes(api, eventController);
  }

  private registerUserRoutes(api: Hono, authCtrl: AuthController) {
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
    api.route("/user", user);
  }

  private registerLeadRoutes(api: Hono, leadCtrl: LeadController) {
    const lead = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    lead.get("/", authCheck, leadCtrl.getLeads);
    lead.get("/:id", authCheck, leadCtrl.getLead);
    lead.post("/", authCheck, leadValidator, leadCtrl.createLead);
    lead.put("/:id", authCheck, leadValidator, leadCtrl.updateLead);
    lead.delete("/:id", authCheck, leadCtrl.deleteLead);

    api.route("/lead", lead);
  }

  private registerEventRoutes(api: Hono, eventCtrl: EventController) {
    const event = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    event.get("/", authCheck, eventCtrl.getEvents);
    event.get("/:id", authCheck, eventCtrl.getEvent);
    event.post("/", authCheck, eventValidator, eventCtrl.createEvent);
    event.put("/:id", authCheck, eventValidator, eventCtrl.updateEvent);
    event.delete("/:id", authCheck, eventCtrl.deleteEvent);

    api.route("/event", event);
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
    await connection.quit();
  }
}

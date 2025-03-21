import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { AssetService } from "../../service/asset.js";
import type { UserService } from "../../service/user.js";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.js";
import { z } from "zod";
import type { AssetQuery } from "../validator/asset.js";

const createAssetSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  assetType: z.enum(["image", "video", "audio", "document"]),
  fileSize: z.number(),
  duration: z.number(),
});

const renameAssetSchema = z.object({
  fileName: z.string().refine((val) => /\.[a-zA-Z0-9]+$/.test(val), {
    message: "File name must include an extension",
  }),
});

export class AssetController {
  private service: AssetService;
  private userService: UserService;

  constructor(service: AssetService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public createAsset = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body = await c.req.json();
      const { fileName, contentType, assetType, fileSize, duration } =
        createAssetSchema.parse(body);

      const result = await this.service.createAsset(
        user.id,
        fileName,
        contentType,
        assetType,
        fileSize,
        duration
      );
      return c.json(result, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getAssets = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const { page, limit, search, asset_type } = c.req.query();
      const query: AssetQuery = {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        asset_type: asset_type as AssetQuery["asset_type"],
      };

      let assets;
      if (user.role === "master" || user.role === "owner") {
        assets = await this.service.getAllAssets(query);
      } else {
        assets = await this.service.getAssetsByUser(user.id, query);
      }
      return c.json(assets);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getAsset = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const assetId = Number(c.req.param("id"));
      const asset = await this.service.getAsset(assetId);

      if (!asset) {
        return serveNotFound(c);
      }

      return c.json(asset);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteAsset = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const assetId = Number(c.req.param("id"));
      const asset = await this.service.getAsset(assetId);
      if (!asset) {
        return serveNotFound(c);
      }
      //only and master role or admin or the owner of the lead
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        asset.user_id !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.deleteAsset(assetId);

      return c.json({ message: "Asset deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public renameAsset = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const assetId = Number(c.req.param("id"));
      const asset = await this.service.getAsset(assetId);
      if (!asset) {
        return serveNotFound(c);
      }
      //only and master role or admin or the owner of the  can update the asset
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        asset.user_id !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const { fileName } = renameAssetSchema.parse(await c.req.json());
      const originalExt = asset.asset_name.split(".").pop()?.toLowerCase();
      const newExt = fileName.split(".").pop()?.toLowerCase();

      if (originalExt !== newExt) {
        return serveBadRequest(
          c,
          `New file name must have the same extension: .${originalExt}`
        );
      }

      await this.service.renameAsset(assetId, fileName);
      return c.json({ message: "Asset renamed successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}

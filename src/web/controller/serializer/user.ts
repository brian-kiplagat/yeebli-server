import { type User } from "../../../schema/schema.js";
import { AssetService } from "../../../service/asset.ts";
import { type BusinessService } from "../../../service/business.js";
import { S3Service } from "../../../service/s3.ts";
import { UserRepository } from "../../../repository/user.js";
import { getContentTypeFromS3Url } from "../../../util/string.js";

type UserResponse = {
  id: number;
  email: string;
  name: string;
  createdAt: Date | null;
  is_verified: boolean | null;
  role: string | null;
  phone: string | null;
  profile_picture: string | null;
  bio: string | null;
  is_banned: boolean | null;
  is_deleted: boolean | null;
  stripe_account_id: string | null;
  subscription_status: string | null;
  auth_provider: "local" | "google";
};

export async function serializeUser(
  user: User,
  s3Service: S3Service,
  userRepository: UserRepository
): Promise<UserResponse> {
  let profile_picture_url = user.profile_picture;

  if (user.profile_picture) {
    // Check if we need to generate a new presigned URL
    const now = new Date();
    if (
      !user.presigned_profile_picture ||
      !user.presigned_profile_picture_expires_at ||
      user.presigned_profile_picture_expires_at < now
    ) {
      // Generate new presigned URL with 7 days expiry
      const key = user.profile_picture.split(".amazonaws.com/")[1];
      if (key) {
        const contentType = getContentTypeFromS3Url(user.profile_picture);
        const presignedUrl = await s3Service.generateGetUrl(
          key,
          contentType,
          432000 // 5 days in seconds
        );

        // Update the user record with new presigned URL and expiry
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        await userRepository.update(user.id, {
          presigned_profile_picture: presignedUrl,
          presigned_profile_picture_expires_at: expiryDate,
        });

        profile_picture_url = presignedUrl;
      }
    } else {
      // Use the cached presigned URL
      profile_picture_url = user.presigned_profile_picture;
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    is_verified: user.is_verified,
    role: user.role,
    phone: user.phone,
    profile_picture: profile_picture_url,
    bio: user.bio,
    is_banned: user.is_banned,
    is_deleted: user.is_deleted,
    stripe_account_id: user.stripe_account_id,
    subscription_status: user.subscription_status,
    auth_provider: user.auth_provider ?? "local",
  };
}

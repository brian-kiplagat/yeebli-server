import { type User } from "../../../schema/schema.js";
import { type BusinessService } from "../../../service/business.js";

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
  businessService: BusinessService
): Promise<UserResponse> {
  

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    is_verified: user.is_verified,
    role: user.role,
    phone: user.phone,
    profile_picture: user.profile_picture,
    bio: user.bio,
    is_banned: user.is_banned,
    is_deleted: user.is_deleted,
    stripe_account_id: user.stripe_account_id,
    subscription_status: user.subscription_status,
    auth_provider: user.auth_provider ?? "local",
    
  };
}

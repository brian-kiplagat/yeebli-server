import type { User } from "../../../schema/schema.ts";
import type { BusinessService } from "../../../service/business.js";

type BusinessWithLogo = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  address: string | null;
  description: string | null;
  logo_asset_id: number | null;
  user_id: number;
  logo?: string | null;
  presignedLogoUrl?: string | null;
};

type UserResponse = {
  id: number;
  name: string;
  email: string;
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
  business?: {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
    logo: string | null | undefined;
    presignedLogoUrl: string | null | undefined;
  } | null;
};

const serializeUser = async (
  user: User,
  businessService: BusinessService
): Promise<UserResponse> => {
  const business = (await businessService.getBusinessByUserId(
    user.id
  )) as BusinessWithLogo;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
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
    business: business
      ? {
          id: business.id,
          name: business.name,
          address: business.address,
          phone: business.phone,
          email: business.email,
          description: business.description,
          logo: business.logo,
          presignedLogoUrl: business.presignedLogoUrl,
        }
      : null,
  };
};

export { serializeUser };

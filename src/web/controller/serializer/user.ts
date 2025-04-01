import { type User } from "../../../schema/schema.js";
import { type BusinessService } from "../../../service/business.js";

type BusinessWithLogo = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  logo_asset_id: number | null;
  logo?: string | null;
  presignedLogoUrl?: string | null;
};

type UserResponse = {
  id: number;
  email: string;
  name: string;
  auth_provider: "local" | "google";
  business: {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
    logo: string | null;
    presignedLogoUrl: string | null;
  } | null;
};

export async function serializeUser(
  user: User,
  businessService: BusinessService
): Promise<UserResponse> {
  const business = user.business as BusinessWithLogo | null;
  if (business) {
    const { logo, presignedLogoUrl } = await businessService.getBusinessLogo(
      business.id
    );
    business.logo = logo;
    business.presignedLogoUrl = presignedLogoUrl;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    auth_provider: user.auth_provider ?? "local",
    business: business
      ? {
          id: business.id,
          name: business.name,
          address: business.address,
          phone: business.phone,
          email: business.email,
          description: business.description,
          logo: business.logo ?? null,
          presignedLogoUrl: business.presignedLogoUrl ?? null,
        }
      : null,
  };
}

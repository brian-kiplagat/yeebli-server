import { User } from "../../../schema/schema.ts";


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
};

const serializeUser = (user: User): UserResponse => {
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
  };
};

export { serializeUser };

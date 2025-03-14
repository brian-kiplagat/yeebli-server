import type { User } from '../../../lib/database.js';

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
  custom_id: string | null;
  is_banned: boolean | null;
  is_deleted: boolean | null;
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
    custom_id: user.custom_id,
    is_banned: user.is_banned,
    is_deleted: user.is_deleted,
  };
};

export { serializeUser };

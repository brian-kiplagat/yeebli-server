import type { User } from '../../../lib/database.js';

type UserResponse = {
  id: number;
  name: string;
  email: string;
  createdAt: Date | null;
  is_verified: boolean | null;
};

const serializeUser = (user: User): UserResponse => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    is_verified: user.is_verified,
  };
};

export { serializeUser };

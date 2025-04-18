import { eq } from 'drizzle-orm';

import { db } from '../lib/database.ts';
import { type NewUser, type User, userRelations, userSchema } from '../schema/schema.js';

export class UserRepository {
  public async create(user: NewUser) {
    return db.insert(userSchema).values(user).$returningId();
  }

  public async find(id: number) {
    return db.query.userSchema.findFirst({
      where: eq(userSchema.id, id),
      with: {
        business: true,
      },
    });
  }

  public async findByEmail(email: string) {
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.email, email),
      with: {
        business: true,
      },
    });
    if (user && !user.auth_provider) {
      user.auth_provider = 'local';
    }
    return user;
  }

  public async update(id: number, user: Partial<User>) {
    return db.update(userSchema).set(user).where(eq(userSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(userSchema).where(eq(userSchema.id, id));
  }
}

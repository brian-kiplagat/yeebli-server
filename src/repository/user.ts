import { eq } from 'drizzle-orm';
import { type NewUser, type User, db } from '../lib/database.js';
import { userSchema } from '../schema/schema.js';

export class UserRepository {
  public async create(user: NewUser) {
    return db.insert(userSchema).values(user);
  }

  public async find(id: number) {
    return db.query.userSchema.findFirst({
      where: eq(userSchema.id, id),
    });
  }

  public async findByEmail(email: string) {
    return db.query.userSchema.findFirst({
      where: eq(userSchema.email, email),
    });
  }

  public async update(id: number, user: Partial<User>) {
    return db.update(userSchema).set(user).where(eq(userSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(userSchema).where(eq(userSchema.id, id));
  }
}

import { eq } from "drizzle-orm";
import { NewUser, User, userSchema } from "../schema/schema.js";
import { db } from "../lib/database.ts";

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
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.email, email),
    });
    if (user && !user.auth_provider) {
      user.auth_provider = "local";
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

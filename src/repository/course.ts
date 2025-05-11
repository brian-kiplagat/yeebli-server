import { and, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { Course, Membership, NewCourse } from '../schema/schema.js';
import {
  assetsSchema,
  courseMembershipSchema,
  courseSchema,
  memberships,
  userSchema,
} from '../schema/schema.js';
import { CourseQuery } from '../web/validator/course.ts';

export class CourseRepository {
  public async create(course: NewCourse) {
    const [courseId] = await db.insert(courseSchema).values(course).$returningId();
    return courseId.id;
  }

  public async find(id: number) {
    const result = await db
      .select({
        course: courseSchema,
        cover: assetsSchema,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
          id: userSchema.id,
        },
      })
      .from(courseSchema)
      .leftJoin(assetsSchema, eq(courseSchema.cover_image_asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(courseSchema.host_id, userSchema.id))
      .where(eq(courseSchema.id, id))
      .limit(1);

    // Get all memberships for this course
    const courseMemberships = await db
      .select({
        id: courseMembershipSchema.id,
        created_at: courseMembershipSchema.created_at,
        updated_at: courseMembershipSchema.updated_at,
        course_id: courseMembershipSchema.course_id,
        membership_id: courseMembershipSchema.membership_id,
        membership: memberships,
      })
      .from(courseMembershipSchema)
      .innerJoin(memberships, eq(courseMembershipSchema.membership_id, memberships.id))
      .where(eq(courseMembershipSchema.course_id, id));

    return {
      ...result[0],
      memberships: courseMemberships.map((cm) => cm.membership),
    };
  }

  public async findAll(query?: CourseQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? and(
          eq(courseSchema.status, 'published'),
          or(
            like(courseSchema.course_name, `%${search}%`),
            like(courseSchema.course_description, `%${search}%`),
          ),
        )
      : eq(courseSchema.status, 'published');

    const courses = await db
      .select({
        course: courseSchema,
        cover: assetsSchema,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
        },
      })
      .from(courseSchema)
      .leftJoin(assetsSchema, eq(courseSchema.cover_image_asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(courseSchema.host_id, userSchema.id))
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(courseSchema.created_at));

    const courseIds = courses.map((c) => c.course.id);
    const courseMemberships = await db
      .select({
        course_id: courseMembershipSchema.course_id,
        membership: memberships,
      })
      .from(courseMembershipSchema)
      .innerJoin(memberships, eq(courseMembershipSchema.membership_id, memberships.id))
      .where(inArray(courseMembershipSchema.course_id, courseIds));

    const coursesWithRelations = courses.map((course) => ({
      ...course,
      memberships: courseMemberships
        .filter((cm) => cm.course_id === course.course.id)
        .map((cm) => cm.membership),
    }));

    return { courses: coursesWithRelations, total: coursesWithRelations.length };
  }

  public async findByUserId(userId: number, query?: CourseQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? and(
          eq(courseSchema.host_id, userId),
          eq(courseSchema.status, 'published'),
          or(
            like(courseSchema.course_name, `%${search}%`),
            like(courseSchema.course_description, `%${search}%`),
          ),
        )
      : and(eq(courseSchema.host_id, userId), eq(courseSchema.status, 'published'));

    const courses = await db
      .select({
        course: courseSchema,
        cover: assetsSchema,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
        },
      })
      .from(courseSchema)
      .leftJoin(assetsSchema, eq(courseSchema.cover_image_asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(courseSchema.host_id, userSchema.id))
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(courseSchema.created_at));

    const courseIds = courses.map((c) => c.course.id);
    const courseMemberships = await db
      .select({
        course_id: courseMembershipSchema.course_id,
        membership: memberships,
      })
      .from(courseMembershipSchema)
      .innerJoin(memberships, eq(courseMembershipSchema.membership_id, memberships.id))
      .where(inArray(courseMembershipSchema.course_id, courseIds));

    const coursesWithRelations = courses.map((course) => ({
      ...course,
      memberships: courseMemberships
        .filter((cm) => cm.course_id === course.course.id)
        .map((cm) => cm.membership),
    }));

    return { courses: coursesWithRelations, total: coursesWithRelations.length };
  }

  public async update(id: number, course: Partial<Course>) {
    return db.update(courseSchema).set(course).where(eq(courseSchema.id, id));
  }

  public async archive(id: number, status: 'draft' | 'published' | 'archived') {
    return db.update(courseSchema).set({ status }).where(eq(courseSchema.id, id));
  }

  public async delete(id: number) {
    await db.delete(courseMembershipSchema).where(eq(courseMembershipSchema.course_id, id));
    return db.delete(courseSchema).where(eq(courseSchema.id, id));
  }

  public async findByAssetId(assetId: number) {
    const result = await db
      .select()
      .from(courseSchema)
      .where(eq(courseSchema.cover_image_asset_id, assetId))
      .limit(1);
    return result[0];
  }

  public async findMembershipsByCourseId(courseId: number) {
    return db
      .select({
        id: courseMembershipSchema.id,
        created_at: courseMembershipSchema.created_at,
        updated_at: courseMembershipSchema.updated_at,
        course_id: courseMembershipSchema.course_id,
        membership_id: courseMembershipSchema.membership_id,
        membership: memberships,
      })
      .from(courseMembershipSchema)
      .innerJoin(memberships, eq(courseMembershipSchema.membership_id, memberships.id))
      .where(eq(courseMembershipSchema.course_id, courseId));
  }

  public async deleteCourseMemberships(courseId: number, membershipIds?: number[]) {
    if (membershipIds) {
      return db
        .delete(courseMembershipSchema)
        .where(
          and(
            eq(courseMembershipSchema.course_id, courseId),
            inArray(courseMembershipSchema.membership_id, membershipIds),
          ),
        );
    }
    return db.delete(courseMembershipSchema).where(eq(courseMembershipSchema.course_id, courseId));
  }

  public async addMemberships(courseId: number, membershipIds: number[]) {
    return db.insert(courseMembershipSchema).values(
      membershipIds.map((id) => ({
        course_id: courseId,
        membership_id: id,
      })),
    );
  }
}

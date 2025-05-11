import { logger } from '../lib/logger.js';
import { CourseRepository } from '../repository/course.js';
import type { Course, CourseWithAsset, CourseWithRelations, Membership } from '../schema/schema.js';
import { CourseQuery } from '../web/validator/course.ts';

export class CourseService {
  private courseRepository: CourseRepository;

  constructor() {
    this.courseRepository = new CourseRepository();
  }

  public async createCourse(course: Course) {
    try {
      const courseId = await this.courseRepository.create(course);
      return courseId;
    } catch (error) {
      logger.error('Error creating course:', error);
      throw error;
    }
  }

  public async getCourse(id: number): Promise<CourseWithRelations | null> {
    try {
      const course = await this.courseRepository.find(id);
      if (!course) {
        return null;
      }
      return course;
    } catch (error) {
      logger.error('Error getting course:', error);
      throw error;
    }
  }

  public async getAllCourses(query?: CourseQuery) {
    try {
      return await this.courseRepository.findAll(query);
    } catch (error) {
      logger.error('Error getting all courses:', error);
      throw error;
    }
  }

  public async getCoursesByUserId(userId: number, query?: CourseQuery) {
    try {
      return await this.courseRepository.findByUserId(userId, query);
    } catch (error) {
      logger.error('Error getting courses by user ID:', error);
      throw error;
    }
  }

  public async updateCourse(id: number, course: Partial<Course>) {
    try {
      await this.courseRepository.update(id, course);
      return await this.getCourse(id);
    } catch (error) {
      logger.error('Error updating course:', error);
      throw error;
    }
  }

  public async archiveCourse(id: number, status: 'draft' | 'published' | 'archived') {
    try {
      await this.courseRepository.archive(id, status);
      return await this.getCourse(id);
    } catch (error) {
      logger.error('Error archiving course:', error);
      throw error;
    }
  }

  public async deleteCourse(id: number) {
    try {
      await this.courseRepository.delete(id);
    } catch (error) {
      logger.error('Error deleting course:', error);
      throw error;
    }
  }

  public async getCourseByAssetId(assetId: number): Promise<CourseWithAsset | null> {
    try {
      return await this.courseRepository.findByAssetId(assetId);
    } catch (error) {
      logger.error('Error getting course by asset ID:', error);
      throw error;
    }
  }

  public async getCourseMemberships(courseId: number): Promise<Membership[]> {
    try {
      const memberships = await this.courseRepository.findMembershipsByCourseId(courseId);
      return memberships.map((cm) => cm.membership);
    } catch (error) {
      logger.error('Error getting course memberships:', error);
      throw error;
    }
  }

  public async updateCourseMemberships(courseId: number, membershipIds: number[]) {
    try {
      // Delete existing memberships
      await this.courseRepository.deleteCourseMemberships(courseId);
      // Add new memberships
      await this.courseRepository.addMemberships(courseId, membershipIds);
      return await this.getCourseMemberships(courseId);
    } catch (error) {
      logger.error('Error updating course memberships:', error);
      throw error;
    }
  }

  public async deleteCourseMemberships(courseId: number, membershipIds?: number[]) {
    try {
      await this.courseRepository.deleteCourseMemberships(courseId, membershipIds);
    } catch (error) {
      logger.error('Error deleting course memberships:', error);
      throw error;
    }
  }
}

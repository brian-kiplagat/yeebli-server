import { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import type { Course } from '../../schema/schema.js';
import { CourseService } from '../../service/course.js';
import { CourseQuery } from '../validator/course.ts';
import { serveInternalServerError } from './resp/error.ts';

export class CourseController {
  private courseService: CourseService;

  constructor() {
    this.courseService = new CourseService();
  }

  public async getAllCourses(c: Context) {
    try {
      const query = c.req.query() as CourseQuery;
      const { courses, total } = await this.courseService.getAllCourses(query);
      return c.json({ courses, total });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async getCourse(c: Context) {
    try {
      const id = parseInt(c.req.param('id'));
      const course = await this.courseService.getCourse(id);
      if (!course) {
        return c.json({ error: 'Course not found' }, 404);
      }
      return c.json(course);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async createCourse(c: Context) {
    try {
      const course = (await c.req.json()) as Course;
      const userId = c.get('user')?.id;
      if (!userId) {
        return c.json({ error: 'User not found' }, 404);
      }
      course.host_id = userId;
      const courseId = await this.courseService.createCourse(course);
      return c.json({ id: courseId }, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async updateCourse(c: Context) {
    try {
      const id = parseInt(c.req.param('id'));
      const course = (await c.req.json()) as Partial<Course>;
      const userId = c.get('user')?.id;
      if (!userId) {
        return c.json({ error: 'User not found' }, 404);
      }
      const existingCourse = await this.courseService.getCourse(id);
      if (!existingCourse) {
        return c.json({ error: 'Course not found' }, 404);
      }
      if (existingCourse.course.host_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      const updatedCourse = await this.courseService.updateCourse(id, course);
      return c.json(updatedCourse);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async archiveCourse(c: Context) {
    try {
      const id = parseInt(c.req.param('id'));
      const { status } = (await c.req.json()) as { status: 'draft' | 'published' | 'archived' };
      const userId = c.get('user')?.id;
      if (!userId) {
        return c.json({ error: 'User not found' }, 404);
      }
      const existingCourse = await this.courseService.getCourse(id);
      if (!existingCourse) {
        return c.json({ error: 'Course not found' }, 404);
      }
      if (existingCourse.course.host_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      const updatedCourse = await this.courseService.archiveCourse(id, status);
      return c.json(updatedCourse);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async deleteCourse(c: Context) {
    try {
      const id = parseInt(c.req.param('id'));
      const userId = c.get('user')?.id;
      if (!userId) {
        return c.json({ error: 'User not found' }, 404);
      }
      const existingCourse = await this.courseService.getCourse(id);
      if (!existingCourse) {
        return c.json({ error: 'Course not found' }, 404);
      }
      if (existingCourse.course.host_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      await this.courseService.deleteCourse(id);
      return c.json({ message: 'Course deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async getCourseMemberships(c: Context) {
    try {
      const id = parseInt(c.req.param('id'));
      const memberships = await this.courseService.getCourseMemberships(id);
      return c.json(memberships);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async updateCourseMemberships(c: Context) {
    try {
      const id = parseInt(c.req.param('id'));
      const { membershipIds } = (await c.req.json()) as { membershipIds: number[] };
      const userId = c.get('user')?.id;
      if (!userId) {
        return c.json({ error: 'User not found' }, 404);
      }
      const existingCourse = await this.courseService.getCourse(id);
      if (!existingCourse) {
        return c.json({ error: 'Course not found' }, 404);
      }
      if (existingCourse.course.host_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      const memberships = await this.courseService.updateCourseMemberships(id, membershipIds);
      return c.json(memberships);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async deleteCourseMemberships(c: Context) {
    try {
      const id = parseInt(c.req.param('id'));
      const { membershipIds } = (await c.req.json()) as { membershipIds?: number[] };
      const userId = c.get('user')?.id;
      if (!userId) {
        return c.json({ error: 'User not found' }, 404);
      }
      const existingCourse = await this.courseService.getCourse(id);
      if (!existingCourse) {
        return c.json({ error: 'Course not found' }, 404);
      }
      if (existingCourse.course.host_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      await this.courseService.deleteCourseMemberships(id, membershipIds);
      return c.json({ message: 'Course memberships deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }
}

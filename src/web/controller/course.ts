import { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import { CourseService } from '../../service/course.js';
import { MembershipService } from '../../service/membership.js';
import { UserService } from '../../service/user.js';
import { CourseQuery, CreateCourseBody, UpdateCourseBody } from '../validator/course.ts';
import { ERRORS, serveBadRequest, serveInternalServerError } from './resp/error.ts';

export class CourseController {
  private courseService: CourseService;
  private userService: UserService;
  private membershipService: MembershipService;
  constructor(
    courseService: CourseService,
    userService: UserService,
    membershipService: MembershipService,
  ) {
    this.courseService = courseService;
    this.userService = userService;
    this.membershipService = membershipService;
  }

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
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
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body: CreateCourseBody = await c.req.json();
      const course = {
        ...body,
        host_id: user.id,
      };
      const { membership_plans } = body;
      if (membership_plans.length < 1) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_REQUIRED);
      }
      ///Create the course first
      const courseId = await this.courseService.createCourse(course);
      // Transform membership plans to match NewMembership type
      const transformedPlans = membership_plans.map((plan) => ({
        name: plan.name,
        user_id: user.id,
        price: plan.isFree ? 0 : plan.price,
        description: 'Sample description',
        payment_type: plan.payment_type,
        price_point: plan.price_point,
        billing: plan.billing,
      }));

      //batch insert the membership plans
      const createdMemberships = await this.membershipService.batchCreateCourseMembership(
        courseId,
        transformedPlans,
      );

      // Create course-membership connections
      await this.membershipService.createCourseMembershipPlans(courseId, createdMemberships);

      //create the module
      const moduleId = await this.courseService.createModule({
        ...body.module,
        course_id: courseId,
        order: 1,
      });

      //create the lesson
      const lessonId = await this.courseService.createLesson({
        ...body.lessons,
        module_id: moduleId,
        order: 1,
      });
      return c.json({ id: courseId, moduleId, lessonId }, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  }

  public async updateCourse(c: Context) {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const id = parseInt(c.req.param('id'));
      const body: UpdateCourseBody = await c.req.json();

      const existingCourse = await this.courseService.getCourse(id);
      if (!existingCourse) {
        return c.json({ error: 'Course not found' }, 404);
      }
      //only and master role or admin or the owner can update the event
      if (
        user.role !== 'master' &&
        user.role !== 'owner' &&
        existingCourse.course.host_id !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }
      const updatedCourse = await this.courseService.updateCourse(id, body);
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

  public async getModules(c: Context) {
    const courseId = parseInt(c.req.param('id'));
    const modules = await this.courseService.getModulesByCourseId(courseId);
    return c.json(modules);
  }

  public async getModule(c: Context) {
    const moduleId = parseInt(c.req.param('moduleId'));
    const module = await this.courseService.getModuleById(moduleId);
    if (!module) {
      return c.json({ error: 'Module not found' }, 404);
    }
    return c.json(module);
  }

  public async createModule(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const courseId = parseInt(c.req.param('id'));
    const course = await this.courseService.getCourse(courseId);
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }

    if (course.course.host_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const module = await c.req.json();
    const moduleId = await this.courseService.createModule({
      ...module,
      course_id: courseId,
    });
    return c.json({ id: moduleId }, 201);
  }

  public async updateModule(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const moduleId = parseInt(c.req.param('moduleId'));
    const module = await this.courseService.getModuleById(moduleId);
    if (!module) {
      return c.json({ error: 'Module not found' }, 404);
    }

    const course = await this.courseService.getCourse(module.course_id);
    if (!course || course.course.host_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const updates = await c.req.json();
    const updatedModule = await this.courseService.updateModule(moduleId, updates);
    return c.json(updatedModule);
  }

  public async deleteModule(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const moduleId = parseInt(c.req.param('moduleId'));
    const module = await this.courseService.getModuleById(moduleId);
    if (!module) {
      return c.json({ error: 'Module not found' }, 404);
    }

    const course = await this.courseService.getCourse(module.course_id);
    if (!course || course.course.host_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await this.courseService.deleteModule(moduleId);
    return c.json({ success: true });
  }

  public async getLesson(c: Context) {
    const lessonId = parseInt(c.req.param('lessonId'));
    const lesson = await this.courseService.getLessonById(lessonId);
    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }
    return c.json(lesson);
  }

  public async createLesson(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const moduleId = parseInt(c.req.param('moduleId'));
    const module = await this.courseService.getModuleById(moduleId);
    if (!module) {
      return c.json({ error: 'Module not found' }, 404);
    }

    const course = await this.courseService.getCourse(module.course_id);
    if (!course || course.course.host_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const lesson = await c.req.json();
    const lessonId = await this.courseService.createLesson({
      ...lesson,
      module_id: moduleId,
    });
    return c.json({ id: lessonId }, 201);
  }

  public async updateLesson(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const lessonId = parseInt(c.req.param('lessonId'));
    const lesson = await this.courseService.getLessonById(lessonId);
    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    const module = await this.courseService.getModuleById(lesson.module_id);
    if (!module) {
      return c.json({ error: 'Module not found' }, 404);
    }

    const course = await this.courseService.getCourse(module.course_id);
    if (!course || course.course.host_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const updates = await c.req.json();
    const updatedLesson = await this.courseService.updateLesson(lessonId, updates);
    return c.json(updatedLesson);
  }

  public async deleteLesson(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const lessonId = parseInt(c.req.param('lessonId'));
    const lesson = await this.courseService.getLessonById(lessonId);
    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    const module = await this.courseService.getModuleById(lesson.module_id);
    if (!module) {
      return c.json({ error: 'Module not found' }, 404);
    }

    const course = await this.courseService.getCourse(module.course_id);
    if (!course || course.course.host_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await this.courseService.deleteLesson(lessonId);
    return c.json({ success: true });
  }

  public async updateProgress(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const progress = await c.req.json();
    const progressId = await this.courseService.updateProgress({
      ...progress,
      user_id: user.id,
    });
    return c.json({ id: progressId });
  }

  public async getProgress(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const progress = await this.courseService.getProgressByUserId(user.id);
    return c.json(progress);
  }
}

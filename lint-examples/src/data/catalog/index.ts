import type { CourseInput } from "@/domain/catalog/course-schema";

export { listCourses } from "./queries";

export function createCourse(input: CourseInput): string {
  return input.title;
}

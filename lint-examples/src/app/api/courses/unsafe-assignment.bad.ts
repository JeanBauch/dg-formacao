import type { CourseInput } from "@/domain/catalog/course-schema";
import { createCourse } from "@/data/catalog";

export async function POST(request: Request) {
  const input: CourseInput = await request.json();
  return createCourse(input);
}

import { courseSchema } from "@/domain/catalog/course-schema";
import { createCourse } from "@/data/catalog";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  return createCourse(courseSchema.parse(body));
}

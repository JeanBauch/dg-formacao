import { createCourse } from "@/data/catalog";

export async function POST(request: Request) {
  return createCourse(await request.json());
}

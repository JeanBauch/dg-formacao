import { cookies } from "next/headers";
import { courseSchema } from "@/domain/catalog/course-schema";

export const readers = [cookies, courseSchema];

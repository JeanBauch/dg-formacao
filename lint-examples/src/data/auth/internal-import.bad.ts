import { listCourses } from "@/data/catalog/queries";
import { listCourses as listCoursesRelative } from "../catalog/queries";

export const courses = [listCourses(), listCoursesRelative()];

import { listCourses } from "../catalog/index";
import { listCourses as listCoursesByAlias } from "@/data/catalog/index";

export const courses = [listCourses(), listCoursesByAlias()];

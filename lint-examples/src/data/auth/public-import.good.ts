import { db } from "@/data/db";
import { catalogTag } from "@/data/tags";
import { listCourses } from "@/data/catalog";

export const snapshot = { db, catalogTag, courses: listCourses() };

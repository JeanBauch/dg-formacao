export type CourseInput = { title: string };

// Stands in for the Zod schema of the module: it turns unknown input into a typed value.
export const courseSchema = {
  parse(input: unknown): CourseInput {
    if (
      typeof input === "object" &&
      input !== null &&
      "title" in input &&
      typeof input.title === "string"
    ) {
      return { title: input.title };
    }
    throw new Error("Invalid course input");
  },
};

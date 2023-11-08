// import {
//   serial,
//   text,
//   timestamp,
//   pgTable,
//   boolean,
//   uuid,
// } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

// export const users = pgTable("users", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   name: text("name"),
//   email: text("email").unique().notNull(),
//   hash: text("hash").unique().notNull(),
//   role: text("role").$type<"admin" | "user">().default("user"),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
//   updatedAt: timestamp("updated_at"),
// });

// export const todos = pgTable("todos", {
//   id: serial("id").primaryKey(),
//   title: text("title").notNull(),
//   completed: boolean("completed").notNull().default(false),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
//   userId: uuid("user_id")
//     .notNull()
//     .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
// });

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").unique().notNull(),
  hash: text("hash").unique().notNull(),
  role: text("role").$type<"admin" | "user">().default("user"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const todos = sqliteTable("todos", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
});

export type Todo = typeof todos.$inferSelect;

export const insertTodoSchema = createInsertSchema(todos, {
  title: z.string().min(1, "Title must be at least 1 character long"),
});
export const insertTodoNoUserSchema = insertTodoSchema.omit({
  userId: true,
});
export const selectTodoSchema = createSelectSchema(todos);
export const selectUserSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

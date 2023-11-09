import { TRPCError, initTRPC } from "@trpc/server";
import { z } from "zod";
import type { Context } from "./context.server";
import { db } from "~/drizzle/config.server";
import {
  insertTodoNoUserSchema,
  loginSchema,
  todos,
  users,
} from "~/drizzle/schema.server";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcrypt";

export const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  todos: t.router({
    all: t.procedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        return [];
      }
      return await db
        .select()
        .from(todos)
        .where(eq(todos.userId, ctx.user.id))
        .orderBy(todos.createdAt);
    }),
    add: t.procedure
      .input(insertTodoNoUserSchema)
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Must be logged in",
          });
        }
        const result = {
          ...input,
          userId: ctx.user.id,
        };
        await db.insert(todos).values(result);
      }),
    delete: t.procedure.input(z.number()).mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Must be logged in",
        });
      }
      await db.delete(todos).where(eq(todos.id, input));
    }),
    toggle: t.procedure
      .input(
        z.object({
          id: z.number(),
          completed: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Must be logged in",
          });
        }
        await db
          .update(todos)
          .set({ completed: input.completed })
          .where(eq(todos.id, input.id));
      }),
  }),
  users: t.router({
    create: t.procedure.input(loginSchema).mutation(async ({ ctx, input }) => {
      if (ctx.user) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already logged in",
        });
      }

      let hashedPassword = await hash(input.password, 10);

      const values = {
        email: input.email,
        hash: hashedPassword,
      };
      const user = await db.insert(users).values(values).returning();
      return user;
    }),
    login: t.procedure.input(loginSchema).mutation(async ({ ctx, input }) => {
      if (ctx.user) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already logged in",
        });
      }
      const user =
        (await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, input.email),
        })) || null;

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User does not exist",
        });
      }

      const passwordMatch = await compare(input.password, user.hash);
      if (!passwordMatch) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incorrect password",
        });
      }

      return user;
    }),
  }),
});

// export type definition of API
export type AppRouter = typeof appRouter;

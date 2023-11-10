import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { Context } from "./context.server";
import { db } from "~/drizzle/config.server";
import {
  changePasswordSchema,
  insertTodoNoUserSchema,
  loginSchema,
  passwordSchema,
  todos,
  users,
} from "~/drizzle/schema.server";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcrypt";
import { logoutOtherSessions } from "~/session.server";

type AUTH_ERROR_CODE_KEY =
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "NOT_FOUND"
  | "BAD_REQUEST";
export class AuthError extends Error {
  public readonly code;
  public readonly field;

  constructor(opts: {
    message?: string;
    code: AUTH_ERROR_CODE_KEY;
    field?: string;
  }) {
    const message = opts.message ?? opts.code;
    const field = opts.field ?? "form";

    super(message);

    this.code = opts.code;
    this.name = "AuthError";
    this.field = field;
  }
}

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
          throw new AuthError({
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
        throw new AuthError({
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
          throw new AuthError({
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
        throw new AuthError({
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
        throw new AuthError({
          code: "CONFLICT",
          message: "Already logged in",
        });
      }
      const user =
        (await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, input.email),
        })) || null;

      if (!user) {
        throw new AuthError({
          code: "NOT_FOUND",
          message: "User does not exist",
          field: "email",
        });
      }

      const passwordMatch = await compare(input.password, user.hash);
      if (!passwordMatch) {
        throw new AuthError({
          code: "BAD_REQUEST",
          message: "Incorrect password",
          field: "password",
        });
      }

      return user;
    }),
    changePassword: t.procedure
      .input(changePasswordSchema)
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new AuthError({
            code: "UNAUTHORIZED",
            message: "Must be logged in",
          });
        }

        const passwordMatch = await compare(
          input.currentPassword,
          ctx.user.hash
        );
        if (!passwordMatch) {
          throw new AuthError({
            code: "BAD_REQUEST",
            message: "Incorrect password",
            field: "currentPassword",
          });
        }

        if (input.newPassword !== input.confirmPassword) {
          throw new AuthError({
            code: "BAD_REQUEST",
            message: "Passwords do not match",
            field: "confirmPassword",
          });
        }

        const hashedPassword = await hash(input.newPassword, 10);
        await db
          .update(users)
          .set({ hash: hashedPassword })
          .where(eq(users.id, ctx.user.id));
      }),
    logoutOtherSessions: t.procedure
      .input(passwordSchema)
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new AuthError({
            code: "UNAUTHORIZED",
            message: "Must be logged in",
          });
        }

        console.log("teswt");

        const passwordMatch = await compare(input.password, ctx.user.hash);
        if (!passwordMatch) {
          throw new AuthError({
            code: "BAD_REQUEST",
            message: "Incorrect password",
            field: "password",
          });
        }

        await logoutOtherSessions(ctx.request, ctx.user.id);
      }),
  }),
});

// export type definition of API
export type AppRouter = typeof appRouter;

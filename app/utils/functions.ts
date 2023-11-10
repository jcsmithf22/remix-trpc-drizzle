import { LibsqlError } from "@libsql/client";
import { redirect } from "@remix-run/node";
import { type TRPCError } from "@trpc/server";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AuthError } from "~/server/router.server";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Error = {
  [key: string]: string[] | undefined;
};

export const handleError = (error: TRPCError) => {
  console.log("TRPC ERROR: ", error);

  if (error.code === "UNAUTHORIZED") {
    throw redirect("/login");
  }

  const errorObject: Error = {};

  if (error.cause instanceof AuthError) {
    if (error.cause.code === "UNAUTHORIZED") {
      throw redirect("/login");
    }
    errorObject[error.cause.field] = [error.cause.message];
  } else if (error.cause instanceof LibsqlError) {
    if (error.cause.code === "SERVER_ERROR") {
      errorObject.email = ["Email already exists"];
    } else {
      errorObject.form = [error.cause.message];
    }
  } else {
    errorObject.form = [error.message];
  }

  return errorObject;
};

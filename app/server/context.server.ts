import type { inferAsyncReturnType } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getUser } from "~/session.server";

export async function createContext({
  req,
  resHeaders,
}: FetchCreateContextFnOptions) {
  const user = await getUser(req);
  return { request: req, user };
}

export type Context = inferAsyncReturnType<typeof createContext>;

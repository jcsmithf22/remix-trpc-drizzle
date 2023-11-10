import {
  createCookieSessionStorage,
  redirect,
  createSessionStorage,
} from "@remix-run/node";
import { db } from "./drizzle/config.server";
import * as crypto from "crypto";
import { Redis } from "@upstash/redis";

const USER_SESSION_KEY = "userId";

// create session types
type SessionData = {
  [USER_SESSION_KEY]: string;
  id: string;
  missing?: true;
};

type Message = {
  id: string;
  title: string;
  type: "success" | "message";
  description?: string;
};

type SessionFlashData = {
  message?: Message;
  logoutMessage?: Message;
};

if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error("Missing environment variable DATABASE_URL");
}

if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Missing environment variable DATABASE_AUTH_TOKEN");
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const expiresToSeconds = (expires: Date | undefined) => {
  if (expires === undefined) {
    // return a single day
    return 60 * 60 * 24;
  }
  const now = new Date();
  const expiresDate = new Date(expires);
  const secondsDelta = (expiresDate.getTime() - now.getTime()) / 1000;
  return Math.round(secondsDelta < 0 ? 0 : secondsDelta);
};

export function createUpstashSessionStorage({ cookie }: any) {
  return createSessionStorage<SessionData>({
    cookie,
    async createData(data, expires) {
      // Create a random id - taken from the core `createFileSessionStorage` Remix function.
      const randomBytes = crypto.getRandomValues(new Uint8Array(4));
      const uniqueKey = Buffer.from(randomBytes).toString("hex");
      const id = `user:${data[USER_SESSION_KEY]}:${uniqueKey}`;
      // Call Upstash Redis HTTP API. Set expiration according to the cookie `expired property.
      // Note the use of the `expiresToSeconds` that converts date to seconds.
      await redis.set(id, data, {
        ex: expiresToSeconds(expires),
      });
      return id;
    },
    async readData(id) {
      try {
        const result = (await redis.get(id)) as SessionData | null;
        if (!result) throw new Error("No session found");
        result.id = id;
        return result;
      } catch (error) {
        console.log(error);
        return {
          [USER_SESSION_KEY]: "",
          id: "",
          missing: true,
        };
      }
    },
    async updateData(id, data, expires) {
      await redis.set(id, data, {
        ex: expiresToSeconds(expires),
      });
    },
    async deleteData(id) {
      // const userId = id.split(":")[1];
      // const results = await redis.scan(0, {
      //   match: `*${userId}*`,
      // });
      // console.log(results);
      await redis.del(id);
    },
  });
}

// we can still use cookie session storage to avoid redis costs

// // create session storage
// export const {
//   getSession: retrieveSession,
//   commitSession,
//   destroySession,
// } = createCookieSessionStorage<SessionData>({
//   cookie: {
//     name: "__session",
//     secrets: ["move_to_env_later"],
//     sameSite: "strict",
//     httpOnly: true,
//     path: "/",
//     secure: process.env.NODE_ENV === "production",
//   },
// });

export const {
  getSession: retrieveSession,
  commitSession,
  destroySession,
} = createUpstashSessionStorage({
  cookie: {
    name: "__session",
    secrets: ["move_to_env_later"],
    sameSite: "strict",
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  },
});

export const flashSession = createCookieSessionStorage<SessionFlashData>({
  cookie: {
    name: "__flash",
    secrets: ["move_to_env_later"],
    sameSite: "lax",
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  },
});

const getUserById = (userId: string) => {
  const user = db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
  });
  return user;
};

// create functions to handle reading/writing sessions
export const getSession = (request: Request) => {
  return retrieveSession(request.headers.get("cookie"));
};

export const getUserId = async (request: Request) => {
  const session = await getSession(request);
  // if session doesn't exist in redis, logout to delete session cookie and redirect to login
  if (session.get("missing")) {
    throw await logout(request, "/login");
  }
  return session.get(USER_SESSION_KEY);
};

export const getUser = async (request: Request) => {
  const userId = await getUserId(request);
  if (userId === undefined) return null;

  const user = await getUserById(userId);
  if (user) return user;

  throw await logout(request);
};

export const requireUserId = async (
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) => {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
};

export const requireUser = async (request: Request) => {
  const userId = await requireUserId(request);

  const user = await getUserById(userId);
  if (user) return user;

  throw await logout(request);
};

export const logout = async (request: Request, redirectTo: string = "/") => {
  const session = await getSession(request);
  const flash = await flashSession.getSession(request.headers.get("cookie"));
  flash.flash("logoutMessage", {
    id: Math.random().toString(),
    title: redirectTo === "/login" ? "Session expired" : "Logout successful",
    type: "success",
  });

  // later incorporate so that if you were logged out externally, you will return
  // to where you were when you log back in

  const headers = new Headers();
  headers.append("set-cookie", await destroySession(session));
  headers.append("set-cookie", await flashSession.commitSession(flash));

  return redirect(redirectTo, {
    headers,
  });
};

export const logoutOtherSessions = async (request: Request, userId: string) => {
  const session = await getSession(request);
  const sessionId = session.get("id");

  const results = await redis.scan(0, {
    match: `*${userId}*`,
  });

  console.log(results);

  for (const key of results[1]) {
    if (key === sessionId) continue;
    await redis.del(key);
  }
};

export const createUserSession = async ({
  request,
  userId,
  remember,
  redirectTo = "/",
}: {
  request: Request;
  userId: string;
  remember: boolean;
  redirectTo?: string;
}) => {
  const session = await getSession(request);
  session.set(USER_SESSION_KEY, userId);

  const maxAge = remember ? 60 * 60 * 24 * 30 : undefined;

  return redirect(redirectTo, {
    headers: {
      "set-cookie": await commitSession(session, {
        maxAge,
      }),
    },
  });
};

export const setFlash = async (
  request: Request,
  name: "message" | "logoutMessage",
  message: Message
) => {
  const flash = await flashSession.getSession(request.headers.get("cookie"));
  flash.flash(name, message);

  return {
    "set-cookie": await flashSession.commitSession(flash),
  };
};

export const getFlash = async (
  request: Request,
  name: "message" | "logoutMessage"
) => {
  const flash = await flashSession.getSession(request.headers.get("cookie"));
  const message = flash.get(name);

  return {
    message,
    headers: { "set-cookie": await flashSession.commitSession(flash) },
  };
};

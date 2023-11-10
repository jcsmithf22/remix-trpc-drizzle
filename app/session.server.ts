import {
  createCookieSessionStorage,
  redirect,
  json,
  createSessionStorage,
} from "@remix-run/node";
import { db } from "./drizzle/config.server";
import * as crypto from "crypto";
import { Redis } from "@upstash/redis";

const USER_SESSION_KEY = "userId";

// create session types
type SessionData = {
  [USER_SESSION_KEY]: string;
};

type SessionFlashData = {
  message: {
    id: string;
    title: string;
    type: "success" | "message";
    description?: string;
  };
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
        return result;
      } catch (error) {
        console.log(error);
        return null;
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

export const logout = async (request: Request) => {
  const session = await getSession(request);
  const flash = await flashSession.getSession(request.headers.get("cookie"));
  flash.flash("message", {
    id: "logout",
    title: "Logout successful",
    type: "success",
    // description: "You have been logged out.",
  });

  const headers = new Headers();
  headers.append("set-cookie", await destroySession(session));
  headers.append("set-cookie", await flashSession.commitSession(flash));

  return json(null, {
    headers,
  });
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

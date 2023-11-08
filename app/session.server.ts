import {
  createCookieSessionStorage,
  redirect,
  json,
  type Session,
} from "@remix-run/node";
import { db } from "./drizzle/config.server";

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

// create session storage
export const {
  getSession: retrieveSession,
  commitSession,
  destroySession,
} = createCookieSessionStorage<SessionData, SessionFlashData>({
  cookie: {
    name: "__session",
    secrets: ["move_to_env_later"],
    sameSite: "strict",
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  },
});

// create functions to handle reading/writing sessions
export const getSession = (request: Request) => {
  return retrieveSession(request.headers.get("cookie"));
};

export const getUserId = async (request: Request) => {
  const session = await getSession(request);
  return session.get(USER_SESSION_KEY);
};

export const getUser = async ({
  request,
  session,
}: {
  request?: Request;
  session?: Session<SessionData, SessionFlashData>;
}) => {
  const userId =
    (request && (await getUserId(request))) ||
    (session && session.get(USER_SESSION_KEY));
  if (!userId) return null;
  const user =
    (await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    })) || null;
  return user;
};

export const logout = async (request: Request) => {
  const session = await getSession(request);
  session.unset(USER_SESSION_KEY);
  session.flash("message", {
    id: "logout",
    title: "Logout successful",
    type: "success",
    // description: "You have been logged out.",
  });
  return json(null, {
    headers: {
      "set-cookie": await commitSession(session),
    },
  });
};

export const createUserSession = async (
  request: Request,
  userId: string,
  redirectPath: string = "/"
) => {
  const session = await getSession(request);
  session.set(USER_SESSION_KEY, userId);

  return redirect(redirectPath, {
    headers: {
      "set-cookie": await commitSession(session),
    },
  });
};

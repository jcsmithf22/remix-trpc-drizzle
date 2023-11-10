import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { appRouter } from "~/server/router.server";
import { createUserSession, getUser } from "~/session.server";
import { loginSchema } from "~/drizzle/schema.server";
import { type TRPCError } from "@trpc/server";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { cn } from "~/utils/functions";
import { safeRedirect } from "~/utils/functions.server";

import { type Error, handleError } from "~/utils/functions";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();
  const values = Object.fromEntries(body.entries());
  const intent = values.intent;
  const remember = values.rememberMe === "on";
  const redirectTo = safeRedirect(values.redirectTo);

  const caller = appRouter.createCaller({
    request,
    user: await getUser(request),
  });

  if (intent === "login") {
    const validate = loginSchema.safeParse(values);

    if (!validate.success) {
      console.log(validate.error.formErrors);
      const error: Error = validate.error.formErrors.fieldErrors;
      return json({
        error,
      });
    }

    try {
      const user = await caller.users.login(validate.data);
      return createUserSession({
        request,
        userId: user.id,
        remember,
        redirectTo,
      });
    } catch (error) {
      return json({
        error: handleError(error as TRPCError),
      });
    }
  }

  if (intent === "register") {
    const validate = loginSchema.safeParse(values);

    if (!validate.success) {
      console.log(validate.error.formErrors);
      const error: Error = validate.error.formErrors.fieldErrors;
      return json({
        error,
      });
    }

    try {
      const [user] = await caller.users.create(validate.data);
      return createUserSession({
        request,
        userId: user.id,
        remember,
        redirectTo,
      });
    } catch (error) {
      return json({
        error: handleError(error as TRPCError),
      });
    }
  }

  return redirect("/");
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const actionData = useActionData<typeof action>();
  const errors = actionData?.error;
  const navigate = useNavigation();
  const intent = (navigate.formData?.get("intent") as string) || null;
  const loading =
    navigate.state === "submitting" || navigate.state === "loading";

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-[512px]">
      <div className="overflow-hidden rounded-md bg-white shadow my-4">
        <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 flex items-center">
            <Link to="/" className="mr-2">
              <ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
            </Link>
            Login
          </h3>
        </div>
        <div className="py-12 px-6 sm:px-12">
          <Form method="post" className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Email
              </label>
              <div className="relative mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors?.email ? "true" : "false"}
                  aria-describedby="email-error"
                  className={cn(
                    "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6",
                    errors?.email &&
                      "ring-red-300 focus:ring-red-500 text-red-900 placeholder:text-red-300"
                  )}
                />
                {errors?.email && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <AlertCircle
                      className="h-5 w-5 text-red-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
              {errors?.email && (
                <p className="mt-2 text-sm text-red-600" id="email-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Password
                </label>
              </div>
              <div className="relative mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors?.password ? "true" : "false"}
                  aria-describedby="password-error"
                  className={cn(
                    "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6",
                    errors?.password &&
                      "ring-red-300 focus:ring-red-500 text-red-900 placeholder:text-red-300"
                  )}
                />
                {errors?.password && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <AlertCircle
                      className="h-5 w-5 text-red-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
              {errors?.password && (
                <p className="mt-2 text-sm text-red-600" id="password-error">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="rememberMe"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                  defaultChecked={true}
                />
                <label
                  htmlFor="remember-me"
                  className="ml-3 block text-sm leading-6 text-gray-900"
                >
                  Remember me
                </label>
              </div>

              {/* <div className="text-sm leading-6">
                <a
                  href="#"
                  className="font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Forgot password?
                </a>
              </div> */}
            </div>

            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div>
              <button
                type="submit"
                name="intent"
                value="login"
                className="flex w-full justify-center items-center rounded-md bg-black px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-black/[85%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                {loading && intent === "login" && (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                )}
                Login
              </button>
            </div>
            {errors?.form && <p className="text-red-600">{errors.form}</p>}
            <div className="relative mt-10">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center font-light text-sm leading-6">
                <span className="bg-white px-6 text-gray-500">
                  Or create an account
                </span>
              </div>
            </div>
            <div>
              <button
                type="submit"
                name="intent"
                value="register"
                className="flex w-full justify-center items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold leading-6 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                {loading && intent === "register" && (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                )}
                Sign Up
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

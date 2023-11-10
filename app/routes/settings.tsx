import {
  type LoaderFunctionArgs,
  json,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { type TRPCError } from "@trpc/server";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import React from "react";
import { changePasswordSchema, passwordSchema } from "~/drizzle/schema.server";
import { appRouter } from "~/server/router.server";
import { getFlash, getUser, requireUser, setFlash } from "~/session.server";
import { type Error, handleError, cn } from "~/utils/functions";
import ShowToast from "~/components/ShowToast";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const { message, headers } = await getFlash(request, "message");
  return json(
    { user, message },
    {
      headers,
    }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();
  const values = Object.fromEntries(body.entries());
  const intent = values.intent;

  const caller = appRouter.createCaller({
    request,
    user: await getUser(request),
  });

  if (intent === "change_password") {
    const validate = changePasswordSchema.safeParse(values);

    if (!validate.success) {
      const error: Error = validate.error.formErrors.fieldErrors;
      return json({
        error,
      });
    }

    try {
      await caller.users.changePassword(validate.data);
      const headers = await setFlash(request, "message", {
        id: Math.random().toString(),
        title: "Password changed successfully",
        type: "success",
        // description: "You have been logged out.",
      });
      const error: Error = {
        success: ["change-pw-success"],
      };
      return json(
        { error },
        {
          headers,
        }
      );
    } catch (error) {
      return json({
        error: handleError(error as TRPCError),
      });
    }
  }

  if (intent === "logout_other_sessions") {
    const validate = passwordSchema.safeParse(values);

    if (!validate.success) {
      const error: Error = validate.error.formErrors.fieldErrors;
      return json({
        error,
      });
    }

    try {
      await caller.users.logoutOtherSessions(validate.data);
      const headers = await setFlash(request, "message", {
        id: Math.random().toString(),
        title: "Logout successful",
        type: "success",
      });
      const error: Error = {
        success: ["session-lg-success"],
      };

      return json(
        { error },
        {
          headers,
        }
      );
    } catch (error) {
      return json({
        error: handleError(error as TRPCError),
      });
    }
  }

  const error: Error = {
    form: ["Invalid intent"],
  };

  return json({
    error,
  });
}

export default function Settings() {
  const { message } = useLoaderData<typeof loader>();
  // console.log(user);
  const fetcher = useFetcher<typeof action>();
  const errors = fetcher.data?.error;
  const passwordFormRef = React.useRef<HTMLFormElement>(null);
  const logoutFormRef = React.useRef<HTMLFormElement>(null);

  const intent = (fetcher.formData?.get("intent") as string) || null;
  const loading = fetcher.state === "submitting";

  React.useEffect(() => {
    if (errors?.success) {
      const success = errors.success[0];
      if (success === "change-pw-success") {
        passwordFormRef.current?.reset();
      }
      if (success === "session-lg-success") {
        logoutFormRef.current?.reset();
      }
    }
  }, [errors]);
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-md bg-white shadow my-4">
        <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 flex items-center">
            <Link to="/" className="mr-2">
              <ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
            </Link>
            Settings
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
              <h2 className="text-base font-semibold leading-7 text-gray-900">
                Change password
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Update your password associated with your account.
              </p>
            </div>

            <fetcher.Form
              method="post"
              className="md:col-span-2"
              ref={passwordFormRef}
            >
              <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                <div className="col-span-full">
                  <label
                    htmlFor="current-password"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Current password
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="current-password"
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      className={cn(
                        "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6",
                        errors?.currentPassword &&
                          "ring-red-300 focus:ring-red-500 text-red-900 placeholder:text-red-300"
                      )}
                    />
                    {errors?.currentPassword && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <AlertCircle
                          className="h-5 w-5 text-red-500"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>
                  {errors?.currentPassword && (
                    <p className="mt-2 text-sm text-red-600" id="email-error">
                      {errors.currentPassword}
                    </p>
                  )}
                </div>

                <div className="col-span-full">
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    New password
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="new-password"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      className={cn(
                        "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6",
                        errors?.newPassword &&
                          "ring-red-300 focus:ring-red-500 text-red-900 placeholder:text-red-300"
                      )}
                    />
                    {errors?.newPassword && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <AlertCircle
                          className="h-5 w-5 text-red-500"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>
                  {errors?.newPassword && (
                    <p className="mt-2 text-sm text-red-600" id="email-error">
                      {errors.newPassword}
                    </p>
                  )}
                </div>

                <div className="col-span-full">
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Confirm password
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="confirm-password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      className={cn(
                        "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6",
                        errors?.confirmPassword &&
                          "ring-red-300 focus:ring-red-500 text-red-900 placeholder:text-red-300"
                      )}
                    />
                    {errors?.confirmPassword && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <AlertCircle
                          className="h-5 w-5 text-red-500"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>
                  {errors?.confirmPassword && (
                    <p className="mt-2 text-sm text-red-600" id="email-error">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 flex">
                <button
                  type="submit"
                  name="intent"
                  value="change_password"
                  className="flex items-center rounded-md bg-black px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black/[85%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                >
                  {loading && intent === "change_password" && (
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  )}
                  Save
                </button>
              </div>
            </fetcher.Form>
          </div>

          <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
              <h2 className="text-base font-semibold leading-7 text-gray-900">
                Log out other sessions
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Please enter your password to confirm you would like to log out
                of your other sessions across all of your devices.
              </p>
            </div>

            <fetcher.Form
              method="post"
              className="md:col-span-2"
              ref={logoutFormRef}
            >
              <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                <div className="col-span-full">
                  <label
                    htmlFor="logout-password"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Your password
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="logout-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
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
                    <p className="mt-2 text-sm text-red-600" id="email-error">
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 flex">
                <button
                  name="intent"
                  value="logout_other_sessions"
                  type="submit"
                  className="flex items-center rounded-md bg-black px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black/[85%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                >
                  {loading && intent === "logout_other_sessions" && (
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  )}
                  Log out other sessions
                </button>
              </div>
            </fetcher.Form>
          </div>

          <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
              <h2 className="text-base font-semibold leading-7 text-gray-900">
                Delete account
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                No longer want to use our service? You can delete your account
                here. This action is not reversible. All information related to
                this account will be deleted permanently.
              </p>
            </div>

            <form className="flex items-start md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                Yes, delete my account
              </button>
            </form>
          </div>
        </div>
      </div>
      {message && <ShowToast toast={message} />}
    </div>
  );
}

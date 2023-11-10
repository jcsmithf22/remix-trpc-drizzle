import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useFetcher, useLoaderData, Link } from "@remix-run/react";
import { insertTodoNoUserSchema } from "~/drizzle/schema.server";
import { appRouter } from "~/server/router.server";
import { z } from "zod";
import { CheckIcon, Loader2, Settings, XIcon } from "lucide-react";
import React from "react";
import { getUser } from "~/session.server";
import { type TRPCError } from "@trpc/server";
import { type Error, handleError } from "~/utils/functions";

export const meta: MetaFunction = () => {
  return [
    { title: "Todos" },
    { name: "description", content: "Welcome to Todos!" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const caller = appRouter.createCaller({ request, user });
  const todos = await caller.todos.all();

  return json({
    todos,
    user,
  });
}

const toggleTodoSchema = z.object({
  id: z.coerce.number(),
  completed: z.string().transform((val) => val === "true"),
});

const deleteTodoSchema = z.object({
  id: z.coerce.number(),
});

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();
  const values = Object.fromEntries(body.entries());
  const intent = values.intent;
  if (values.intent) {
    delete values.intent;
  }

  const caller = appRouter.createCaller({
    request,
    user: await getUser(request),
  });

  if (intent === "add") {
    const validate = insertTodoNoUserSchema.safeParse(values);

    if (!validate.success) {
      console.log(validate.error.formErrors);
      const error: Error = validate.error.formErrors.fieldErrors;
      return json({
        error,
      });
    }

    try {
      await caller.todos.add(validate.data);
    } catch (error) {
      return json({
        error: handleError(error as TRPCError),
      });
    }
  }

  if (intent === "toggle") {
    const validate = toggleTodoSchema.safeParse(values);

    if (!validate.success) {
      console.log(validate.error.formErrors);
      const error: Error = validate.error.formErrors.fieldErrors;
      return json({
        error,
      });
    }

    try {
      await caller.todos.toggle(validate.data);
    } catch (error) {
      return json({
        error: handleError(error as TRPCError),
      });
    }
  }

  if (intent === "delete") {
    const validate = deleteTodoSchema.safeParse(values);

    if (!validate.success) {
      console.log(validate.error.formErrors);
      const error: Error = validate.error.formErrors.fieldErrors;
      return json({
        error,
      });
    }

    try {
      await caller.todos.delete(validate.data.id);
    } catch (error) {
      return json({
        error: handleError(error as TRPCError),
      });
    }
  }

  return json({
    error: null,
  });
}

export default function Index() {
  const { todos, user } = useLoaderData<typeof loader>();
  const username = user?.email || user?.name || null;
  const fetcher = useFetcher<typeof action>();
  const logoutFetcher = useFetcher();

  // const errors = fetcher.data?.error || null;
  // console.log(errors);

  const formRef = React.useRef<HTMLFormElement>(null);

  const isAdding =
    fetcher.state === "submitting" && fetcher.formData?.get("intent") === "add";

  const pendingAdd = isAdding || fetcher.state === "loading";

  React.useEffect(() => {
    if (!pendingAdd) {
      formRef.current?.reset();
    }
  }, [pendingAdd]);

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-md bg-white shadow my-4">
          <div className="flex justify-between items-center border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              Todos
            </h3>
            <Link
              to="/settings"
              className="p-2 rounded-full hover:bg-gray-100 -m-2"
            >
              <Settings className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
            </Link>
          </div>
          <ul className="divide-y divide-gray-200">
            {username ? (
              <li>
                <fetcher.Form method="post" ref={formRef}>
                  <input
                    name="title"
                    type="text"
                    placeholder="Add a todo"
                    className="rounded-b-md w-full focus:ring-0 border-0 px-6 py-4"
                  />
                  <input type="hidden" value="add" name="intent" />
                </fetcher.Form>
              </li>
            ) : (
              <li className="px-6 py-4 text-gray-400">
                <Link to="/login" className="hover:underline">
                  Login to add todos
                </Link>
              </li>
            )}
            {todos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
            {pendingAdd && (
              <li className="px-6 py-4 text-gray-400 flex items-center">
                <Loader2 className="mr-2 animate-spin h-5 w-5 text-gray-500" />
                Adding...
              </li>
            )}
          </ul>
        </div>
        <logoutFetcher.Form method="post" action="/logout">
          <button type="submit">Logout</button>
        </logoutFetcher.Form>
        <p>{username || "not logged in"}</p>
      </div>
    </>
  );
}

interface TodoItemProps {
  todo: {
    id: number;
    title: string;
    completed: boolean;
    createdAt: string;
  };
}

const TodoItem = ({ todo }: TodoItemProps) => {
  const fetcher = useFetcher();

  const optimisticComplete = fetcher.formData?.get("completed");
  let completed = todo.completed;
  if (optimisticComplete === "true" || optimisticComplete === "false") {
    completed = optimisticComplete === "true";
  }

  const isDeleting =
    fetcher.formData?.get("intent") === "delete" &&
    fetcher.formData?.get("id") === String(todo.id);

  return (
    <li key={todo.id} hidden={isDeleting} className="px-6 py-4 group">
      <div className="flex items-center gap-x-4">
        <fetcher.Form method="post" className="h-8">
          <input type="hidden" name="completed" value={String(!completed)} />
          <input type="hidden" name="id" value={todo.id} />
          <button
            type="submit"
            value="toggle"
            name="intent"
            className={`w-8 h-8 rounded-full border hover:bg-gray-50 ${
              completed ? "border-blue-200" : "border-gray-200"
            } flex items-center justify-center`}
          >
            {completed ? <CheckIcon className="w-5 h-5 text-blue-500" /> : null}
          </button>
        </fetcher.Form>
        <div
          className={`flex-1 ${isDeleting ? "opacity-50" : ""} ${
            completed ? "line-through text-gray-400" : ""
          }`}
        >
          {todo.title}
        </div>
        <fetcher.Form
          method="post"
          className="sm:group-hover:block block sm:hidden sm:group-focus-within:block"
        >
          <input type="hidden" name="id" value={todo.id} />
          <button
            type="submit"
            value="delete"
            name="intent"
            className="h-8 w-8 rounded-full flex justify-center items-center"
          >
            <XIcon strokeWidth={1} className="text-red-600" />
          </button>
        </fetcher.Form>
      </div>
    </li>
  );
};

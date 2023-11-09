import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { requireUser } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  return json({
    data: user,
  });
}

export default function Protected() {
  return (
    <div>
      <h1>Protected</h1>
    </div>
  );
}

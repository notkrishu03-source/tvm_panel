import "server-only";
import { z, ZodError } from "zod";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type HandlerArgs<P, B> = {
  req: Request;
  user: SessionUser;
  params: P;
  body: B;
};

type Options<B extends z.ZodType> = {
  /** Require an admin session. */
  admin?: boolean;
  /** Allow unauthenticated calls (login / register). */
  public?: boolean;
  /** Zod schema for the JSON body. */
  schema?: B;
};

/**
 * Wraps a route handler with auth, JSON parsing, validation and error handling.
 * Mutating requests must be sent as `application/json`, which cannot be forged
 * by a cross-site HTML form (CSRF protection together with non-simple CORS).
 */
export function route<P = Record<string, string>, B extends z.ZodType = z.ZodUnknown>(
  handler: (args: HandlerArgs<P, z.infer<B>>) => Promise<unknown>,
  options: Options<B> = {},
) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      let user = null as SessionUser | null;
      if (!options.public) {
        user = await getCurrentUser();
        if (!user) throw new ApiError(401, "You are not signed in");
        if (options.admin && user.role !== "admin")
          throw new ApiError(403, "Administrator access required");
      }

      let body: unknown = {};
      if (req.method !== "GET" && req.method !== "HEAD") {
        const type = req.headers.get("content-type") ?? "";
        if (type.includes("application/json")) {
          try {
            body = await req.json();
          } catch {
            throw new ApiError(400, "Invalid JSON body");
          }
        } else if (req.method !== "DELETE") {
          throw new ApiError(415, "Content-Type must be application/json");
        }
      }

      if (options.schema) body = options.schema.parse(body);

      const params = (await ctx.params) ?? ({} as P);
      const result = await handler({
        req,
        user: user as SessionUser,
        params,
        body: body as z.infer<B>,
      });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        const field = issue?.path.join(".");
        return Response.json(
          { error: field ? `${field}: ${issue?.message}` : (issue?.message ?? "Invalid input") },
          { status: 400 },
        );
      }
      console.error("[api]", err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export function parseId(value: string | undefined, label = "id"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, `Invalid ${label}`);
  return n;
}

/** Shared field validators */
export const f = {
  username: z
    .string()
    .trim()
    .min(3, "must be at least 3 characters")
    .max(24, "must be at most 24 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "may only contain letters, numbers and underscores"),
  email: z.string().trim().toLowerCase().email("must be a valid email").max(255),
  password: z
    .string()
    .min(8, "must be at least 8 characters")
    .max(128, "must be at most 128 characters"),
  vmName: z
    .string()
    .trim()
    .min(2, "must be at least 2 characters")
    .max(30, "must be at most 30 characters")
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9-]*$/,
      "may only contain letters, numbers and dashes",
    ),
};

import {
  checkCredentials,
  checkPassword,
  clearedCookie,
  createUser,
  currentUser,
  endSession,
  handle,
  normaliseEmail,
  startSession,
} from "@/lib/auth";

type Params = { params: Promise<{ action: string }> };

async function readCredentials(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  return { email: normaliseEmail(body.email), password: checkPassword(body.password) };
}

// POST /api/auth/signup | signin | signout
export async function POST(request: Request, { params }: Params) {
  const { action } = await params;
  return handle(async (req) => {
    if (action === "signup") {
      const { email, password } = await readCredentials(req);
      const userId = await createUser(email, password);
      if (!userId) return Response.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
      return Response.json({ email }, { status: 201, headers: { "set-cookie": await startSession(userId) } });
    }
    if (action === "signin") {
      const { email, password } = await readCredentials(req);
      const userId = await checkCredentials(email, password);
      if (!userId) return Response.json({ error: "Wrong email or password." }, { status: 401 });
      return Response.json({ email }, { headers: { "set-cookie": await startSession(userId) } });
    }
    if (action === "signout") {
      await endSession(req);
      return Response.json({ signedOut: true }, { headers: { "set-cookie": clearedCookie } });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  })(request);
}

// GET /api/auth/me
export async function GET(request: Request, { params }: Params) {
  const { action } = await params;
  return handle(async (req) => {
    if (action !== "me") return Response.json({ error: "not_found" }, { status: 404 });
    const user = await currentUser(req);
    return user ? Response.json({ email: user.email }) : Response.json({ error: "not_signed_in" }, { status: 401 });
  })(request);
}

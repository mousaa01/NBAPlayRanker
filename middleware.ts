import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const coachOnly = ["/matchup", "/context"];
const analystOnly = ["/data-explorer", "/model-metrics", "/statistical-analysis"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected =
    coachOnly.some((p) => path.startsWith(p)) ||
    analystOnly.some((p) => path.startsWith(p));

  const isAuthPage = path === "/login" || path === "/signup";

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = profile?.role === "coach" ? "/matchup" : "/data-explorer";
      return NextResponse.redirect(url);
    }

    if (profile?.role === "coach" && analystOnly.some((p) => path.startsWith(p))) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (profile?.role === "analyst" && coachOnly.some((p) => path.startsWith(p))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./login-form";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";

export const metadata = { title: "Anmelden" };

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getSessionUser();
  if (user) redirect("/");

  const searchParams = await props.searchParams;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const entraEnabled = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);
  const devEnabled =
    process.env.DEV_LOGIN_ENABLED === "true" && process.env.NODE_ENV !== "production";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-2 flex size-11 items-center justify-center rounded-xl">
            <CalendarClock className="size-6" />
          </div>
          <CardTitle className="text-xl">{APP_NAME}</CardTitle>
          <CardDescription>{APP_TAGLINE}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm entraEnabled={entraEnabled} devEnabled={devEnabled} error={error} />
        </CardContent>
      </Card>
    </main>
  );
}

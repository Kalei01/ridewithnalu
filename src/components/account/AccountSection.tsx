import { useState } from "react";
import { LogIn, LogOut, Trash2 } from "lucide-react";
import { deleteMyAccount } from "@/lib/account.functions";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountSection() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const name = user?.user_metadata?.["full_name"] as string | undefined;
  const avatar = user?.user_metadata?.["avatar_url"] as string | undefined;

  async function social(provider: "google" | "apple") {
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error)
      setMessage(`${provider === "google" ? "Google" : "Apple"} sign-in is unavailable right now.`);
  }

  async function emailAuth(mode: "signin" | "signup") {
    setMessage(null);
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session)
      setMessage("Check your email to confirm your account.");
  }

  async function resetPassword() {
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMessage(error ? error.message : "Check your email for a password reset link.");
  }

  if (loading) return null;
  return (
    <section className="space-y-3 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Account</p>
      {user ? (
        <div className="rounded-lg bg-surface-raised p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={avatar} alt="" />
              <AvatarFallback>{(name || user.email || "N")[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{name || "Nalu rider"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Your saved places and preferences sync across signed-in devices.
          </p>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut /> Sign out
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" className="mt-3 w-full text-destructive"><Trash2 className="size-4" /> Delete account</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your Nalu account?</AlertDialogTitle>
                <AlertDialogDescription>This permanently deletes your account, synced saved places and preferences, and linked notification subscriptions. Places stored only on this device will remain until you clear this app's data.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Keep account</AlertDialogCancel>
                <Button variant="destructive" disabled={deleting} onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteMyAccount();
                    await supabase.auth.signOut();
                    setMessage("Your account has been deleted.");
                  } catch {
                    setMessage("We couldn't delete your account. Please try again.");
                  } finally { setDeleting(false); }
                }}>{deleting ? "Deleting…" : "Delete permanently"}</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg bg-surface-raised p-4">
          <p className="text-sm text-muted-foreground">
            Optional. Guest access stays fully available.
          </p>
          <Button variant="outline" onClick={() => void social("google")}>
            <LogIn /> Continue with Google
          </Button>
          <Button variant="outline" onClick={() => void social("apple")}>
            <LogIn /> Continue with Apple
          </Button>
          <div className="grid gap-2 border-t border-border pt-3">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Label htmlFor="account-password">Password</Label>
            <Input
              id="account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => void emailAuth("signin")} disabled={!email || !password}>
                Sign in
              </Button>
              <Button
                variant="outline"
                onClick={() => void emailAuth("signup")}
                disabled={!email || password.length < 6}
              >
                Create account
              </Button>
            </div>
            <Button
              variant="link"
              className="h-auto justify-start px-0 text-xs"
              onClick={() => void resetPassword()}
            >
              Forgot password?
            </Button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}

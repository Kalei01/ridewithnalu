import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset password · Nalu" },
    { name: "description", content: "Choose a new password for your Nalu account." },
    { property: "og:title", content: "Reset password · Nalu" },
    { property: "og:description", content: "Choose a new password for your Nalu account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    void supabase.auth.getSession().then(({ data }) => setReady(recovery || Boolean(data.session)));
  }, []);
  async function save() {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else { setMessage("Password updated."); window.setTimeout(() => void navigate({ to: "/" }), 600); }
  }
  return <main className="browse-radiance flex min-h-dvh items-center justify-center px-5"><section className="glass-panel w-full max-w-sm rounded-lg p-6"><h1 className="text-2xl font-bold">Reset password</h1>{ready ? <><Label htmlFor="new-password" className="mt-5 block">New password</Label><Input id="new-password" type="password" autoComplete="new-password" className="mt-2" value={password} onChange={(e) => setPassword(e.target.value)} /><Button className="mt-4 w-full" disabled={password.length < 6} onClick={() => void save()}>Update password</Button></> : <p className="mt-4 text-sm text-muted-foreground">Open the password reset link from your email.</p>}{message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}</section></main>;
}
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminOnly() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <ShieldAlert className="h-8 w-8 text-primary" />
      <h1 className="mt-4 text-lg font-semibold text-foreground">Administrators only</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page is restricted. Ask the school administrator if you need access.
      </p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}

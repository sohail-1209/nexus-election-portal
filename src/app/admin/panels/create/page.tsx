
"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";

// This page is a temporary redirect to fix a 404 error.
// The "Create Panel" functionality has been removed, so we redirect
// any lingering links to the main dashboard.
export default function CreatePanelRedirectPage() {
  useEffect(() => {
    redirect("/admin/dashboard");
  }, []);

  return null;
}

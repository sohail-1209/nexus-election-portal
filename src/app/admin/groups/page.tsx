
"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";

// This page has been removed. Redirect to the dashboard.
export default function RemovedGroupsPage() {
  useEffect(() => {
    redirect("/admin/dashboard");
  }, []);

  return null;
}

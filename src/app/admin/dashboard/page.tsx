
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionPanels } from "@/lib/electionRoomService";
import type { ElectionPanel } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, AlertTriangle, ArrowRight, CalendarDays, Server } from "lucide-react";
import Link from "next/link";
import { format } from 'date-fns';

function PanelSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <Skeleton className="h-10 w-56" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PanelCard({ panel }: { panel: ElectionPanel }) {
    return (
        <Card className="flex flex-col hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center gap-3">
                    <Server className="h-6 w-6 text-primary" />
                    {panel.title}
                </CardTitle>
                <CardDescription className="text-sm line-clamp-3 pt-2">{panel.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                    <CalendarDays className="mr-2 h-4 w-4 text-primary" /> Created: {format(new Date(panel.createdAt), "PPP")}
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="default" asChild className="w-full">
                    <Link href={`/admin/panels/${panel.id}`}>
                        View Panel <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function AdminDashboardPage() {
  const [electionPanels, setElectionPanels] = useState<ElectionPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const panelsData = await getElectionPanels();
          setElectionPanels(panelsData);
        } catch (err: any) {
          console.error("Failed to fetch panels:", err);
          if (err.code === 'permission-denied') {
            setError("You do not have permission to view the dashboard. Please contact support.");
          } else {
            setError("An unexpected error occurred while loading the dashboard. Please try again later.");
          }
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return <PanelSkeleton />;
  }
  
  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-10 shadow-xl border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">Error Loading Dashboard</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={() => router.push('/admin/login')}>
            Go to Login Page
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
          <h1 className="text-3xl font-bold font-headline">Election Panels</h1>
          <p className="text-muted-foreground mt-2">Select a panel to manage its rooms or create a new one.</p>
      </div>

      <div className="flex justify-center">
        <Button asChild size="lg">
          <Link href="/admin/panels/create">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Election Panel
          </Link>
        </Button>
      </div>

      {electionPanels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {electionPanels.map(panel => (
              <PanelCard key={panel.id} panel={panel} />
            ))}
          </div>
      ) : (
        <Card className="text-center py-16">
          <CardHeader>
            <CardTitle className="text-2xl">No Panels Yet</CardTitle>
            <CardDescription>Get started by creating your first election panel.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

    
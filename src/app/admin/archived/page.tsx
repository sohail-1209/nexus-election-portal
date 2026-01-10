
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getArchivedRooms, restoreRoom } from "@/lib/electionRoomService";
import type { ElectionRoom } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Archive, ArchiveRestore, ArrowLeft, CalendarDays, Vote, Star } from "lucide-react";
import Link from "next/link";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function ArchivedPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="text-center">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-80 mx-auto mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
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

function ArchivedRoomCard({ room, onRoomRestored }: { room: ElectionRoom; onRoomRestored: (roomId: string) => void; }) {
  const { toast } = useToast();
  
  const handleRestore = async () => {
    const result = await restoreRoom(room.id);
    if (result.success) {
      toast({
        title: "Room Restored",
        description: `"${room.title}" has been restored to the dashboard.`,
      });
      onRoomRestored(room.id);
    } else {
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: result.message,
      });
    }
  };

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow duration-300 bg-muted/30">
      <CardHeader>
        <CardTitle className="text-lg font-headline line-clamp-2">{room.title}</CardTitle>
        <CardDescription className="text-sm line-clamp-2 pt-1">{room.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center">
          {room.roomType === 'review' ? <Star className="mr-2 h-4 w-4" /> : <Vote className="mr-2 h-4 w-4" />}
          Room Type: {room.roomType === 'review' ? 'Review' : 'Voting'}
        </div>
        <div className="flex items-center">
          <CalendarDays className="mr-2 h-4 w-4" /> Archived (Created: {format(new Date(room.createdAt), "PPP")})
        </div>
      </CardContent>
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full">
              <ArchiveRestore className="mr-2 h-4 w-4" /> Restore Room
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore this room?</AlertDialogTitle>
              <AlertDialogDescription>
                This will make "{room.title}" visible on the main dashboard again with a 'pending' status. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

export default function ArchivedRoomsPage() {
  const [archivedRooms, setArchivedRooms] = useState<ElectionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchArchivedData = useCallback(async () => {
    try {
      setLoading(true);
      const rooms = await getArchivedRooms();
      setArchivedRooms(rooms);
    } catch (err: any) {
      console.error("Failed to fetch archived rooms:", err);
      setError("An unexpected error occurred while loading archived rooms.");
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchArchivedData();
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [router, fetchArchivedData]);

  const handleRoomRestored = (restoredRoomId: string) => {
    setArchivedRooms(prevRooms => prevRooms.filter(room => room.id !== restoredRoomId));
  };

  if (loading) {
    return <ArchivedPageSkeleton />;
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-10 shadow-xl border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={() => router.push('/admin/dashboard')}>
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" asChild>
        <Link href="/admin/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </Button>

      <div className="text-center">
        <h1 className="text-3xl font-bold font-headline flex items-center justify-center gap-3">
          <Archive className="h-8 w-8" />
          Archived Rooms
        </h1>
        <p className="text-muted-foreground mt-2">These rooms are hidden from the main dashboard. You can restore them at any time.</p>
      </div>

      {archivedRooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {archivedRooms.map(room => (
            <ArchivedRoomCard key={room.id} room={room} onRoomRestored={handleRoomRestored} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-24">
          <CardHeader>
            <CardTitle className="text-2xl">No Archived Rooms</CardTitle>
            <CardDescription>Your archive is empty. When you delete a room from the dashboard, it will appear here.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

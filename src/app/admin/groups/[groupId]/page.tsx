
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getGroupById, getRoomsForGroup } from "@/lib/electionRoomService";
import type { ElectionRoom, ElectionGroup } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertTriangle, CalendarDays, Settings, BarChart3, Users, LockKeyhole, Vote, Star, Folder } from "lucide-react";
import Link from "next/link";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";

function GroupPageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-48" />
      <div className="text-center">
        <Skeleton className="h-10 w-1/2 mx-auto" />
        <Skeleton className="h-5 w-1/3 mx-auto mt-2" />
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
            <CardFooter className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ElectionRoom['status'] }) {
  switch (status) {
    case 'active':
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    case 'closed':
      return <Badge variant="destructive">Closed</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

function RoomTypeBadge({ type }: { type: ElectionRoom['roomType'] }) {
  if (type === 'review') {
    return <Badge variant="outline" className="text-purple-600 border-purple-500/50"><Star className="mr-1 h-3 w-3" /> REVIEW</Badge>;
  }
  return <Badge variant="outline" className="text-primary border-primary/50"><Vote className="mr-1 h-3 w-3" /> VOTING</Badge>;
}

function RoomCard({ room }: { room: ElectionRoom }) {
    return (
        <Card className="flex flex-col hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
                 <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg font-headline mb-1 line-clamp-2 flex-grow">{room.title}</CardTitle>
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <RoomTypeBadge type={room.roomType} />
                    </div>
                </div>
                <CardDescription className="text-sm line-clamp-3 pt-1">{room.description}</CardDescription>
                 <div className="flex items-center gap-2 pt-2">
                    <StatusBadge status={room.status} />
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-primary" /> {room.positions.reduce((acc, p) => acc + p.candidates.length, 0)} Candidates
                </div>
                <div className="flex items-center">
                    <CalendarDays className="mr-2 h-4 w-4 text-primary" /> Created: {format(new Date(room.createdAt), "PPP")}
                </div>
                {room.isAccessRestricted && (
                    <div className="flex items-center">
                        <LockKeyhole className="mr-2 h-4 w-4 text-primary" /> Access Restricted
                    </div>
                )}
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2">
                 <Button variant="outline" asChild className="w-full">
                    <Link href={`/admin/rooms/${room.id}/manage`}>
                        <Settings className="mr-2 h-4 w-4" /> Manage
                    </Link>
                </Button>
                <Button variant="default" asChild className="w-full">
                    <Link href={`/admin/rooms/${room.id}/results`}>
                        <BarChart3 className="mr-2 h-4 w-4" /> Results
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const router = useRouter();

  const [group, setGroup] = useState<ElectionGroup | null>(null);
  const [rooms, setRooms] = useState<ElectionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setError("Group ID is missing from the URL.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const groupData = await getGroupById(groupId);
          if (!groupData) {
            notFound();
            return;
          }
          setGroup(groupData);

          const roomsData = await getRoomsForGroup(groupId);
          setRooms(roomsData);

        } catch (err: any) {
          console.error("Failed to fetch group data:", err);
          setError("An error occurred while loading the group details.");
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [groupId, router]);

  if (loading) {
    return <GroupPageSkeleton />;
  }
  
  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-10 shadow-xl border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">Error Loading Group</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link href="/admin/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!group) {
    return notFound();
  }

  return (
    <div className="space-y-8">
       <Button variant="outline" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>

      <div className="text-center">
          <h1 className="text-3xl font-bold font-headline flex items-center justify-center">
            <Folder className="mr-4 h-8 w-8 text-primary" />
            Group: {group.name}
          </h1>
          <p className="text-muted-foreground mt-2">Displaying all {rooms.length} rooms within this group.</p>
      </div>

      {rooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <CardHeader>
            <CardTitle className="text-2xl">This Group is Empty</CardTitle>
            <CardDescription>There are no rooms currently assigned to this group.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

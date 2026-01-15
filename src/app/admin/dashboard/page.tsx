
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionRoomsAndGroups } from "@/lib/electionRoomService";
import type { ElectionRoom } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, AlertTriangle, BarChart3, Users, LockKeyhole, Settings, Vote, Star, CalendarDays } from "lucide-react";
import Link from "next/link";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import DeleteRoomDialog from "@/components/app/admin/DeleteRoomDialog";
import { useSettingsStore } from "@/stores/settingsStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <Card key={i} className="h-[70vh]">
            <CardHeader className="flex flex-row justify-between items-center">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-9 w-32" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Card>
                <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
              </Card>
               <Card>
                <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
              </Card>
            </CardContent>
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
    return (
      <Badge variant="outline" className="text-purple-600 border-purple-500/50">
        <Star className="mr-1 h-3 w-3" /> REVIEW
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-primary border-primary/50">
      <Vote className="mr-1 h-3 w-3" /> VOTING
    </Badge>
  );
}

function RoomCard({ room, onRoomDeleted }: { room: ElectionRoom; onRoomDeleted: () => void; }) {
    const { enableDeletion } = useSettingsStore();

    return (
        <Card className="flex flex-col hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
                 <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg font-headline mb-1 line-clamp-2 flex-grow">{room.title}</CardTitle>
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <StatusBadge status={room.status} />
                        <RoomTypeBadge type={room.roomType} />
                    </div>
                </div>
                <CardDescription className="text-sm line-clamp-3 pt-1">{room.description}</CardDescription>
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
            <CardFooter className="grid grid-cols-2 gap-2 items-center">
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
                <div className="col-span-2">
                   {enableDeletion && <DeleteRoomDialog roomId={room.id} roomTitle={room.title} onRoomDeleted={onRoomDeleted} />}
                </div>
            </CardFooter>
        </Card>
    );
}

function RoomList({ rooms, roomType, onRoomDeleted }: { rooms: ElectionRoom[], roomType: 'voting' | 'review', onRoomDeleted: () => void }) {
    const isVoting = roomType === 'voting';
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 flex justify-between items-center pb-4">
                <div>
                    <h2 className="text-xl font-bold font-headline">{isVoting ? "Voting Rooms" : "Review & Rating Rooms"}</h2>
                    <p className="text-sm text-muted-foreground">{isVoting ? "Create and manage standard elections." : "Gather feedback and ratings."}</p>
                </div>
                <Button asChild size="sm" variant={isVoting ? "default" : "secondary"}>
                  <Link href={isVoting ? "/admin/rooms/create" : "/admin/rooms/create-review"}>
                      <PlusCircle /> Create New
                  </Link>
                </Button>
            </div>
            <ScrollArea className="flex-grow pr-4 -mr-4">
              <div className="h-full">
                  {rooms.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {rooms.map(room => (
                            <RoomCard key={room.id} room={room} onRoomDeleted={onRoomDeleted} />
                        ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-20 border-2 border-dashed rounded-lg h-full flex items-center justify-center">
                        No {isVoting ? 'voting' : 'review'} rooms found.
                    </div>
                  )}
              </div>
            </ScrollArea>
        </div>
    );
}

export default function AdminDashboardPage() {
  const [electionRooms, setElectionRooms] = useState<ElectionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { rooms } = await getElectionRoomsAndGroups();
      setElectionRooms(rooms);
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      if (err.code === 'permission-denied') {
        setError("You do not have permission to view the dashboard. Please contact support.");
      } else {
        setError("An unexpected error occurred while loading the dashboard. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData();
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [router, fetchData]);

  const { votingRooms, reviewRooms } = useMemo(() => {
    const votingRooms = electionRooms.filter(room => room.roomType !== 'review' && room.status !== 'archived');
    const reviewRooms = electionRooms.filter(room => room.roomType === 'review' && room.status !== 'archived');
    return { votingRooms, reviewRooms };
  }, [electionRooms]);

  if (loading) {
    return <DashboardSkeleton />;
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
      <div className="flex h-[calc(100vh-8.7rem)]">
        <Tabs defaultValue="voting" orientation="vertical" className="flex w-full gap-8">
            <TabsList className={cn(
                "flex flex-col h-full justify-start items-stretch p-2 w-52",
                "bg-transparent border-r"
            )}>
                <TabsTrigger value="voting" className="justify-start gap-2 text-base py-3 px-4 transition-colors duration-200 hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
                    <Vote /> Voting Rooms
                </TabsTrigger>
                <TabsTrigger value="review" className="justify-start gap-2 text-base py-3 px-4 transition-colors duration-200 hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
                    <Star /> Review Rooms
                </TabsTrigger>
            </TabsList>
            <TabsContent value="voting" className="flex-1 min-w-0 pr-6">
                <RoomList rooms={votingRooms} roomType="voting" onRoomDeleted={fetchData} />
            </TabsContent>
            <TabsContent value="review" className="flex-1 min-w-0 pr-6">
                <RoomList rooms={reviewRooms} roomType="review" onRoomDeleted={fetchData} />
            </TabsContent>
        </Tabs>
      </div>
  );
}

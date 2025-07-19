
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionRooms, deleteElectionRoom } from "@/lib/electionRoomService";
import type { ElectionRoom } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Settings, BarChart3, Users, CalendarDays, LockKeyhole, CheckCircle, Clock, XCircle, AlertTriangle, PenSquare, Vote, Star, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

function StatusBadge({ status }: { status: ElectionRoom['status'] }) {
  switch (status) {
    case 'active':
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-1 h-3 w-3" /> Active</Badge>;
    case 'pending':
      return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
    case 'closed':
      return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Closed</Badge>;
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

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-56" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
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

function RoomCard({ room, openDeleteDialog }: { room: ElectionRoom, openDeleteDialog: (room: ElectionRoom) => void }) {
    return (
        <Card className="flex flex-col hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg font-headline mb-1 line-clamp-2 flex-grow">{room.title}</CardTitle>
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <RoomTypeBadge type={room.roomType} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => openDeleteDialog(room)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete Room</span>
                        </Button>
                    </div>
                </div>
                <CardDescription className="text-sm line-clamp-2">{room.description}</CardDescription>
                <div className="flex items-center gap-2 pt-2">
                    <StatusBadge status={room.status} />
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-primary" /> {room.positions.reduce((acc, p) => acc + p.candidates.length, 0)} Candidates across {room.positions.length} Positions
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

export default function AdminDashboardPage() {
  const [electionRooms, setElectionRooms] = useState<ElectionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<ElectionRoom | null>(null);
  const [accountPassword, setAccountPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const roomsData = await getElectionRooms();
          setElectionRooms(roomsData);
        } catch (err: any) {
          console.error("Failed to fetch data:", err);
          if (err.code === 'permission-denied') {
            setError("You do not have permission to view the panel. Please contact support if you believe this is an error.");
          } else {
            setError("An unexpected error occurred while loading the panel. Please try again later.");
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

  const openDeleteDialog = (room: ElectionRoom) => {
    setRoomToDelete(room);
    setIsDeleteDialogOpen(true);
    setAccountPassword("");
    setShowPassword(false);
  };

  const handleConfirmDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomToDelete) return;

    setIsDeleting(true);
    const result = await deleteElectionRoom(roomToDelete.id, accountPassword);
    
    if (result.success) {
      toast({
        title: "Room Deleted",
        description: `"${roomToDelete.title}" has been successfully deleted.`,
      });
      setElectionRooms(rooms => rooms.filter(r => r.id !== roomToDelete.id));
      setIsDeleteDialogOpen(false);
      setRoomToDelete(null);
      setAccountPassword("");
    } else {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: result.message,
      });
    }
    setIsDeleting(false);
  };

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
          <CardTitle className="text-2xl">Error Loading Panel</CardTitle>
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
    <>
    <div className="space-y-8">
      <div className="text-center">
          <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage all your election and review rooms here.</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <Button asChild variant="secondary">
          <Link href="/admin/rooms/create-review">
            <PenSquare className="mr-2 h-5 w-5" /> Create New Review Room
          </Link>
        </Button>
        <Button asChild>
          <Link href="/admin/rooms/create">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Voting Room
          </Link>
        </Button>
      </div>

      {electionRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {electionRooms.map(room => (
              <RoomCard key={room.id} room={room} openDeleteDialog={openDeleteDialog} />
            ))}
          </div>
      ) : (
        <Card className="text-center py-16">
          <CardHeader>
            <CardTitle className="text-2xl">No Rooms Yet</CardTitle>
            <CardDescription>Get started by creating a new voting or review room.</CardDescription>
          </CardHeader>
        </Card>
      )}

    </div>

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the room 
            <span className="font-bold"> "{roomToDelete?.title}" </span> 
            and all of its data. To proceed, please enter your account password to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={handleConfirmDelete}>
          <div className="space-y-2 my-4">
              <Label htmlFor="account-password">Your Account Password</Label>
              <div className="relative">
                <Input
                    id="account-password"
                    type={showPassword ? "text" : "password"}
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoFocus
                    className="pr-10"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
              </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRoomToDelete(null); setAccountPassword(""); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={isDeleting || !accountPassword}>
               {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

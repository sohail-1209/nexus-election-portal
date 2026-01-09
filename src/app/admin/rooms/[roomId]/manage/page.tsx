
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { getElectionRoomById } from "@/lib/electionRoomService";
import type { ElectionRoom, Voter } from "@/lib/types";

import ElectionRoomForm from '@/components/app/admin/ElectionRoomForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BarChart3, AlertTriangle, Fingerprint, Users, Activity, CheckCircle, LogIn, Loader2, Share2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ShareableLinkDisplay from "@/components/app/admin/ShareableLinkDisplay";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ReviewRoomForm from "@/components/app/admin/ReviewRoomForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


function LiveStatusSkeleton() {
    return (
        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center">
                    <Activity className="mr-3 h-6 w-6 text-primary" />
                    <Skeleton className="h-7 w-[300px]" />
                </CardTitle>
                <Skeleton className="h-4 w-[400px]" />
            </CardHeader>
            <CardContent>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Participant</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Last Activity</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...Array(2)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-[100px] ml-auto" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}

function LiveStatusDisplay({ room }: { room: ElectionRoom }) {
    const [participants, setParticipants] = useState<Voter[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const votersColRef = collection(db, "electionRooms", room.id, "voters");
        const q = query(votersColRef, orderBy("lastActivity", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedParticipants = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    email: doc.id,
                    status: data.status,
                    lastActivity: data.lastActivity?.toDate().toISOString(),
                    ownPositionTitle: data.ownPositionTitle,
                };
            });
            setParticipants(fetchedParticipants);
            setIsLoading(false);
        }, (error) => {
            console.error("Error listening to participant updates:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [room.id]);

    if (isLoading) {
        return <LiveStatusSkeleton />;
    }

    const title = room.roomType === 'review' ? 'Reviewer' : 'Voter';

    return (
        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center">
                    <Activity className="mr-3 h-6 w-6 text-primary" />
                    Live Participation Status
                </CardTitle>
                <CardDescription>
                    {participants.length} {participants.length === 1 ? 'person has' : 'people have'} entered.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {participants.length > 0 ? (
                    <div className="border rounded-lg max-h-80 overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
                                <TableRow>
                                    <TableHead>{title}</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Last Activity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {participants.map((p) => (
                                    <TableRow key={p.email}>
                                        <TableCell className="font-medium">
                                            <div className="truncate max-w-[120px] sm:max-w-xs">{p.email}</div>
                                            {p.ownPositionTitle && (
                                                <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-xs">{p.ownPositionTitle}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {p.status === 'completed' ? (
                                                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                                    <CheckCircle className="mr-1 h-3 w-3" /> Done
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    <LogIn className="mr-1 h-3 w-3" /> In
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-xs">
                                            {p.lastActivity ? format(new Date(p.lastActivity), "PP p") : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground border-dashed border-2 rounded-lg">
                        <p>No one has entered the room yet.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


export default function ManageElectionRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<ElectionRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }

    if (!roomId) {
        setError("Room ID is missing from the URL.");
        setLoading(false);
        return;
    };
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const roomData = await getElectionRoomById(roomId);
          
          if (!roomData) {
            notFound();
            return;
          }
          setRoom(roomData);
        } catch (err: any) {
          console.error("Failed to fetch data:", err);
          if (err.code === 'permission-denied') {
             setError("You do not have permission to view this page. Please ensure you are logged in as an admin.");
          } else {
            setError("An unexpected error occurred while loading the page. Please try again later.");
          }
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [roomId, router]);

  if (loading) {
     return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" /> 
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-3/5">
             <Card>
                <CardHeader>
                  <Skeleton className="h-8 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" /> 
                </CardHeader>
                <CardContent className="flex items-center justify-center h-96">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </CardContent>
              </Card>
          </div>
          <div className="lg:w-2/5 space-y-6">
            <LiveStatusSkeleton />
            <Card>
              <CardHeader><Skeleton className="h-7 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-10 w-1/2" /></CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-10 shadow-xl border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">Error Loading Page</CardTitle>
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

  if (!room) {
    return notFound(); 
  }

  const voterLink = `${baseUrl}/vote/${room.id}`;

  const renderForm = () => {
    if (room.roomType === 'review') {
      return <ReviewRoomForm initialData={room} />;
    }
    return <ElectionRoomForm initialData={room} />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Access & Sharing</DialogTitle>
                <DialogDescription>
                  Share this room with participants. For the link to work correctly when your app is deployed,
                  ensure your environment variable is set to your app's public URL.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Alert variant="default">
                  <Fingerprint className="h-4 w-4" />
                  <AlertTitle>Your Room ID</AlertTitle>
                  <AlertDescription>
                    Participants can use this ID to manually access the room from the main <Link href="/vote" className="underline font-semibold">entry page</Link>.
                    <div className="mt-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                        {room.id}
                      </code>
                    </div>
                  </AlertDescription>
                </Alert>
                <ShareableLinkDisplay voterLink={voterLink} />
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="default" asChild>
            <Link href={`/admin/rooms/${room.id}/results`}>
              <BarChart3 className="mr-2 h-4 w-4" /> View Results
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column */}
        <div className="w-full lg:w-3/5 space-y-6">
            <Card className="shadow-xl">
                <CardHeader>
                <CardTitle className="text-3xl font-headline">Manage: {room.title}</CardTitle>
                <CardDescription>Edit details, positions, candidates, and manage access for this {room.roomType} room.</CardDescription>
                </CardHeader>
                <CardContent>
                {renderForm()}
                </CardContent>
            </Card>
        </div>

        {/* Right Column */}
        <div className="w-full lg:w-2/5 space-y-6 sticky top-20">
            <LiveStatusDisplay room={room} />

            <Card>
                <CardHeader>
                <CardTitle className="text-xl font-headline">Voter Participation</CardTitle>
                <CardDescription>
                    View the list of all participants who have completed their submission.
                </CardDescription>
                </CardHeader>
                <CardContent>
                <Button asChild>
                    <Link href={`/admin/rooms/${room.id}/voters`}>
                    <Users className="mr-2 h-4 w-4" /> View Participant List
                    </Link>
                </Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

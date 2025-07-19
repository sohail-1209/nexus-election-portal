
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { getElectionRoomById } from "@/lib/electionRoomService";
import { getBranches } from "@/lib/branchService";
import type { ElectionRoom, Voter, Branch } from "@/lib/types";

import ElectionRoomForm from '@/components/app/admin/ElectionRoomForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BarChart3, AlertTriangle, Fingerprint, Users, Activity, CheckCircle, LogIn, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from 'next/image';
import ShareableLinkDisplay from "@/components/app/admin/ShareableLinkDisplay";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ReviewRoomForm from "@/components/app/admin/ReviewRoomForm";


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
                                    <TableCell><Skeleton className="h-5 w-[200px]" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-[150px] ml-auto" /></TableCell>
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
                    Real-time tracking of participants in this room. A total of {participants.length} {participants.length === 1 ? 'person has' : 'people have'} entered.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {participants.length > 0 ? (
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm">
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
                                            <div className="truncate max-w-xs">{p.email}</div>
                                            {p.ownPositionTitle && (
                                                <div className="text-xs text-muted-foreground">{p.ownPositionTitle}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {p.status === 'completed' ? (
                                                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                                    <CheckCircle className="mr-1 h-3 w-3" /> Completed
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    <LogIn className="mr-1 h-3 w-3" /> In Room
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {p.lastActivity ? format(new Date(p.lastActivity), "PPP p") : 'N/A'}
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    // Set base URL only on the client side
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
          const [roomData, branchesData] = await Promise.all([
            getElectionRoomById(roomId),
            getBranches()
          ]);
          
          if (!roomData) {
            notFound();
            return;
          }
          setRoom(roomData);
          setBranches(branchesData);
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
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" /> {/* Back button */}
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" /> {/* Title */}
            <Skeleton className="h-4 w-1/2" /> {/* Description */}
          </CardHeader>
          <CardContent className="flex items-center justify-center h-64">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </CardContent>
        </Card>
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
    if (branches.length === 0) {
      return (
         <div className="text-center text-muted-foreground p-8">
            <p>Cannot edit this room because no branches exist.</p>
            <p className="text-sm">Please create a branch from the dashboard first.</p>
        </div>
      )
    }
    if (room.roomType === 'review') {
      return <ReviewRoomForm initialData={room} branches={branches} />;
    }
    return <ElectionRoomForm initialData={room} branches={branches} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Panel
          </Link>
        </Button>
        <Button variant="default" asChild>
          <Link href={`/admin/rooms/${room.id}/results`}>
            <BarChart3 className="mr-2 h-4 w-4" /> View Results
          </Link>
        </Button>
      </div>
      
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Manage: {room.title}</CardTitle>
          <CardDescription>Edit details, positions, candidates, and manage access for this {room.roomType} room.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderForm()}
        </CardContent>
      </Card>

      <LiveStatusDisplay room={room} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Access & Sharing</CardTitle>
          <CardDescription>
            Share this room with voters. For the link to work correctly when your app is deployed,
            ensure your <code className="font-mono bg-muted px-1 rounded">NEXT_PUBLIC_BASE_URL</code> environment variable is set to your app's public URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <Alert variant="default">
            <Fingerprint className="h-4 w-4" />
            <AlertTitle>Your Room ID</AlertTitle>
            <AlertDescription>
              Voters can use this ID to manually access the room from the main <Link href="/vote" className="underline font-semibold">voting page</Link>.
              <div className="mt-2">
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                  {room.id}
                </code>
              </div>
            </AlertDescription>
          </Alert>
          <ShareableLinkDisplay voterLink={voterLink} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Voter Participation</CardTitle>
          <CardDescription>
            View the list of emails for everyone who has cast a ballot in this election.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/admin/rooms/${room.id}/voters`}>
              <Users className="mr-2 h-4 w-4" /> View Voter List
            </Link>
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}

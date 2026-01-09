
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getElectionRoomById, getVotersForRoom } from "@/lib/electionRoomService";
import { ArrowLeft, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from 'date-fns';
import { useEffect, useState } from "react";
import type { ElectionRoom, Voter } from "@/lib/types";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function VoterListSkeleton() {
    return (
        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="text-3xl font-headline flex items-center">
                    <Users className="mr-3 h-8 w-8 text-primary" />
                    <Skeleton className="h-8 w-[400px]" />
                </CardTitle>
                <Skeleton className="h-4 w-[300px]" />
            </CardHeader>
            <CardContent>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Participant Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Date Submitted</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-[250px]" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-[120px] ml-auto" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}

export default function VoterListPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [room, setRoom] = useState<ElectionRoom | null>(null);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setError("Room ID is missing.");
      setLoading(false);
      return;
    };
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const completedVoters = await getVotersForRoom(roomId);
          const roomData = await getElectionRoomById(roomId);

          if (!roomData) {
            notFound();
            return;
          }
          
          setRoom(roomData);
          setVoters(completedVoters.filter(v => v.status === 'completed'));

        } catch (err: any) {
          console.error("Firebase Error:", err);
          if (err.code === 'permission-denied') {
            setError("You do not have permission to view this page. Please ensure you are logged in as an admin.");
          } else {
            setError("Failed to load voter data. Please try again later.");
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
            <Button variant="outline" asChild>
                <Link href={`/admin/dashboard`}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Link>
            </Button>
            <VoterListSkeleton />
        </div>
    );
  }

  if (error) {
     return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Button variant="outline" asChild>
                <Link href={`/admin/dashboard`}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Link>
            </Button>
            <Card className="shadow-xl border-destructive">
                <CardHeader>
                  <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
                      <AlertTriangle className="h-10 w-10" />
                  </div>
                  <CardTitle className="text-destructive text-center">Access Denied</CardTitle>
                  <CardDescription className="text-center">{error}</CardDescription>
                </CardHeader>
                 <CardContent className="text-center">
                    <Button asChild>
                        <Link href="/admin/login">Go to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!room) {
    return notFound();
  }
  
  const pageTitle = room.roomType === 'review' ? 'Reviewer List' : 'Voter List';
  const pageDescription = room.roomType === 'review' 
    ? `This is a list of all individuals who have submitted a review. A total of ${voters.length} review(s) have been submitted.`
    : `This is a list of all individuals who have participated in this election. A total of ${voters.length} voter(s) have participated.`;
  const noParticipantsMessage = room.roomType === 'review' 
    ? "No reviews have been submitted yet."
    : "No voters have participated in this election yet.";


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" asChild>
          <Link href={`/admin/rooms/${room.id}/manage`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Manage
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center">
            <Users className="mr-3 h-8 w-8 text-primary" />
            {pageTitle} for: {room.title}
          </CardTitle>
          <CardDescription>
            {pageDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {voters.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Date Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voters.map((voter) => (
                    <TableRow key={voter.email}>
                      <TableCell className="font-medium">{voter.email}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="mr-1 h-3 w-3" /> Submitted
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {voter.votedAt ? format(new Date(voter.votedAt), "PPP p") : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>{noParticipantsMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

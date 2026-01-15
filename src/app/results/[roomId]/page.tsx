
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, notFound } from "next/navigation";
import { getElectionRoomById } from "@/lib/electionRoomService";
import type { ElectionRoom, Position } from "@/lib/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import ResultsLoading from "@/app/admin/rooms/[roomId]/results/loading";
import ReviewResultsDisplay from "@/components/app/admin/ReviewResultsDisplay";
import StarRating from "@/components/app/StarRating";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import ResultsTable from "@/components/app/admin/ResultsTable";


function ReviewLeaderboard({ positions }: { positions: Position[] }) {
    const leaderboardData = useMemo(() => {
        if (!positions) return [];
        return [...positions].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    }, [positions]);

    if (leaderboardData.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center text-2xl font-headline">
                    <Trophy className="mr-3 h-7 w-7 text-amber-500" />
                    Overall Leaderboard
                </CardTitle>
                <CardDescription>All positions ranked by average star rating.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Rank</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Reviewed Person</TableHead>
                            <TableHead className="text-right">Average Rating</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {leaderboardData.map((position, index) => (
                            <TableRow key={position.id}>
                                <TableCell className="font-bold text-lg text-center">{index + 1}</TableCell>
                                <TableCell className="font-medium">{position.title}</TableCell>
                                <TableCell className="text-muted-foreground">{position.candidates[0]?.name || 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span className="font-bold text-base">
                                            {(position.averageRating || 0).toFixed(2)}
                                        </span>
                                        <StarRating rating={position.averageRating || 0} onRatingChange={() => {}} disabled={true} />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default function ReadOnlyResultsPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  
  const [room, setRoom] = useState<ElectionRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoomData = useCallback(async () => {
    if (!roomId) return;
    try {
      const roomData = await getElectionRoomById(roomId, { withVoteCounts: true });
      if (!roomData || !roomData.finalized) {
        setError("Results are not available or the room has not been finalized yet.");
        return;
      }
      setRoom(roomData);
    } catch (err: any) {
      console.error("Failed to fetch results:", err);
      setError("An unexpected error occurred while loading the results.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);


  if (loading) {
    return <ResultsLoading />;
  }

  if (error || !room) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-10 shadow-xl border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">Results Not Available</CardTitle>
          <CardDescription>{error || "Could not load results for this room."}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
              <Link href={'/'}>
                Back to Home
              </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  const renderResults = () => {
      const positions = room.finalizedResults?.positions || [];
      const totalParticipants = room.finalizedResults?.totalParticipants || 0;

      if (room.roomType === 'review') {
          return (
              <div className="space-y-8">
                  <ReviewResultsDisplay room={room} positions={positions} />
                  <ReviewLeaderboard positions={positions} />
              </div>
          );
      }
      
      if (room.roomType === 'voting') {
          return (
             <Card>
                <CardHeader>
                    <CardTitle>Final Voting Results</CardTitle>
                    <CardDescription>
                    The results below are final. Based on {totalParticipants} participant(s).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResultsTable positions={positions} totalCompletedVoters={totalParticipants} room={room} />
                </CardContent>
            </Card>
          )
      }

      return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-8">
          <div>
              <h1 className="text-3xl font-bold font-headline mt-2">Results: {room.title}</h1>
              <p className="text-muted-foreground mt-2">{room.description}</p>
          </div>
        
          {renderResults()}
      </div>
    </div>
  );
}


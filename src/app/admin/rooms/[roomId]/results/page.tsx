
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionRoomById, getVotersForRoom } from "@/lib/electionRoomService";
import type { ElectionRoom, Position } from "@/lib/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, Trophy, Loader2, FileText, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ResultsTable from "@/components/app/admin/ResultsTable";
import ResultsLoading from "./loading";
import ReviewResultsDisplay from "@/components/app/admin/ReviewResultsDisplay";
import StarRating from "@/components/app/StarRating";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


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

export default function ElectionResultsPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [room, setRoom] = useState<ElectionRoom | null>(null);
  const [totalCompletedVoters, setTotalCompletedVoters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoomData = useCallback(async () => {
    if (!roomId) return;
    try {
      const roomData = await getElectionRoomById(roomId, { withVoteCounts: true });
      if (!roomData) {
        notFound();
        return;
      }
      setRoom(roomData);

      if (roomData.roomType !== 'review') {
        const voters = await getVotersForRoom(roomId);
        const completedVoters = voters.filter(v => v.status === 'completed');
        setTotalCompletedVoters(completedVoters.length);
      }
    } catch (err: any) {
      console.error("Failed to fetch results:", err);
      if (err.code === 'permission-denied') {
        setError("You do not have permission to view this page. Please ensure you are logged in as an admin.");
      } else {
        setError("An unexpected error occurred while loading the results. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
        setError("Room ID is missing from the URL.");
        setLoading(false);
        return;
    };
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        fetchRoomData();
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [roomId, router, fetchRoomData]);


  const handleExportMarkdown = async () => {
    if (!room) return;
    setIsExporting(true);

    let mdContent = `# 📊 Results for: ${room.title}\n\n`;
    mdContent += `*${room.description}*\n\n`;
    mdContent += `**Generated on:** ${new Date().toLocaleString()}\n\n`;
    mdContent += `**Room Status:** \`${room.status}\`\n\n`;
    mdContent += "---\n\n";

    if (room.roomType === 'review') {
        mdContent += `## Review Summary\n\n`;
        room.positions.forEach(position => {
            mdContent += `### **${position.title}** - *${position.candidates[0]?.name || 'N/A'}*\n`;
            mdContent += `- **Average Rating:** ${position.averageRating?.toFixed(2) || 'N/A'} / 5.00 ★\n`;
            mdContent += `- **Total Reviews:** ${position.reviews?.length || 0}\n\n`;
            mdContent += `#### Individual Feedback:\n\n`;
            if (position.reviews && position.reviews.length > 0) {
                position.reviews.forEach((review) => {
                    mdContent += `> ${review.feedback}\n\n`;
                });
            } else {
                mdContent += `_No feedback submitted for this position._\n\n`;
            }
            mdContent += `\n---\n\n`;
        });
    } else {
      mdContent += `## Voting Results\n\n`;
      mdContent += `*Based on **${totalCompletedVoters}** completed participant(s).*\n\n`;

      room.positions.forEach(position => {
        const sortedCandidates = [...position.candidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        const maxVotes = sortedCandidates.length > 0 ? (sortedCandidates[0].voteCount || 0) : 0;
        
        mdContent += `### ${position.title}\n\n`;
        mdContent += `| Rank | Candidate | Votes | Percentage |\n`;
        mdContent += `|:----:|:----------|:------|:-----------|\n`;
        
        sortedCandidates.forEach((candidate, index) => {
          const percentage = totalCompletedVoters > 0 ? (((candidate.voteCount || 0) / totalCompletedVoters) * 100).toFixed(1) : "0.0";
          const isWinner = maxVotes > 0 && (candidate.voteCount || 0) === maxVotes;
          const rankDisplay = isWinner ? `🏆 ${index + 1}` : `${index + 1}`;
          mdContent += `| ${rankDisplay} | ${candidate.name} | ${candidate.voteCount || 0}/${totalCompletedVoters} | ${percentage}% |\n`;
        });
        mdContent += `\n`;
      });
    }

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = room.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}_results.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };


  if (loading) {
    return <ResultsLoading />;
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-10 shadow-xl border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">Error Loading Results</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
              <Link href={'/admin/dashboard'}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!room) {
    return notFound();
  }

  const renderResults = () => {
    if (room.roomType === 'review') {
        return (
            <div className="space-y-8">
                <ReviewResultsDisplay room={room} />
                <ReviewLeaderboard positions={room.positions} />
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Detailed Results</CardTitle>
                <CardDescription>
                Comprehensive breakdown of votes for each candidate. 
                Vote counts and percentages are based on the {totalCompletedVoters} participant(s) who completed the process.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResultsTable positions={room.positions} totalCompletedVoters={totalCompletedVoters} />
            </CardContent>
        </Card>
    )
  }


  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <Button variant="outline" asChild className="mb-2 sm:mb-0 sm:mr-4">
            <Link href={'/admin/dashboard'}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
            </Button>
            <h1 className="text-3xl font-bold font-headline mt-2">Results: {room.title}</h1>
            <p className="text-muted-foreground mt-2">{room.description}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button disabled={isExporting} className="w-full sm:w-auto" onClick={handleExportMarkdown}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                {isExporting ? 'Exporting...' : 'Export as .md Code'}
            </Button>
        </div>
      </div>

       {room.status === 'closed' && room.roomType === 'voting' && (
         <Alert variant="default" className="border-green-600/50 bg-green-500/5">
           <CheckCircle className="h-4 w-4 text-green-600" />
           <AlertTitle>Election Closed</AlertTitle>
           <AlertDescription>
            This election is complete. The results below are final.
           </AlertDescription>
         </Alert>
       )}


      {room.status !== 'closed' && (
        <Card className="border-primary bg-primary/5">
            <CardHeader>
                <CardTitle>Room In Progress or Pending</CardTitle>
                <CardDescription>
                    This room is currently '{room.status}'. Results shown are based on current submissions and may change.
                    Final results will be available once the room is closed.
                </CardDescription>
            </CardHeader>
        </Card>
      )}
      
      {renderResults()}

    </div>
    </>
  );
}

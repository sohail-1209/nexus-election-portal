
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionRoomById, getVotersForRoom } from "@/lib/electionRoomService";
import type { ElectionRoom, Position, Candidate } from "@/lib/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, Trophy, Loader2, FileText, CheckCircle, Users, Share2, ShieldAlert } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import ResultsTable from "@/components/app/admin/ResultsTable";
import ResultsLoading from "./loading";
import ReviewResultsDisplay from "@/components/app/admin/ReviewResultsDisplay";
import StarRating from "@/components/app/StarRating";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ShareableLinkDisplay from "@/components/app/admin/ShareableLinkDisplay";
import FinalizeRoomDialog from "@/components/app/admin/FinalizeRoomDialog";
import ConflictResolver, { type WinnerConflict } from "@/components/app/admin/ConflictResolver";


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

// Function to find winners for a given position
const findWinners = (position: Position): Candidate[] => {
    if (!position.candidates || position.candidates.length === 0) {
        return [];
    }
    const maxVotes = Math.max(...position.candidates.map(c => c.voteCount || 0));
    if (maxVotes === 0) {
        return [];
    }
    return position.candidates.filter(c => (c.voteCount || 0) === maxVotes);
};

export default function ElectionResultsPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [room, setRoom] = useState<ElectionRoom | null>(null);
  const [totalCompletedVoters, setTotalCompletedVoters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  
  const [winnerConflicts, setWinnerConflicts] = useState<WinnerConflict[]>([]);
  const [resolvedConflicts, setResolvedConflicts] = useState<Record<string, string>>({}); // candidateId -> chosen positionId
  const [hasConfirmedResolutions, setHasConfirmedResolutions] = useState(false);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const fetchRoomData = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const roomData = await getElectionRoomById(roomId, { withVoteCounts: true });
      if (!roomData) {
        notFound();
        return;
      }
      setRoom(roomData);

      if (roomData.finalized && roomData.finalizedResults) {
        setTotalCompletedVoters(roomData.finalizedResults.totalParticipants);
      } else {
        const voters = await getVotersForRoom(roomId);
        const completedVoters = voters.filter(v => v.status === 'completed');
        const count = roomData.roomType === 'review'
            ? Math.max(...(roomData.positions.map(p => p.reviews?.length || 0)), 0)
            : completedVoters.length;
        setTotalCompletedVoters(count);
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
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) fetchRoomData();
      else router.push('/admin/login');
    });
    return () => unsubscribe();
  }, [roomId, router, fetchRoomData]);

  useEffect(() => {
    if (!room || room.roomType !== 'voting' || room.finalized) {
      setWinnerConflicts([]);
      return;
    }

    const winsByCandidate = new Map<string, { name: string; positions: { positionId: string; positionTitle: string }[] }>();

    room.positions.forEach(position => {
      const winners = findWinners(position);
      winners.forEach(winner => {
        const existing = winsByCandidate.get(winner.id) || { name: winner.name, positions: [] };
        existing.positions.push({ positionId: position.id, positionTitle: position.title });
        winsByCandidate.set(winner.id, existing);
      });
    });

    const conflicts: WinnerConflict[] = [];
    winsByCandidate.forEach((data, candidateId) => {
      if (data.positions.length > 1) {
        conflicts.push({
          candidateId,
          candidateName: data.name,
          wonPositions: data.positions,
        });
      }
    });

    setWinnerConflicts(conflicts);
  }, [room]);
  
  const handleConfirmResolutions = (resolutions: Record<string, string>) => {
    setResolvedConflicts(resolutions);
    setHasConfirmedResolutions(true);
  };
  
  const finalPositions = useMemo(() => {
    if (!room) return [];
    if (room.finalized && room.finalizedResults) return room.finalizedResults.positions;
    if (room.roomType !== 'voting' || !hasConfirmedResolutions || winnerConflicts.length === 0) {
      return room.positions;
    }

    // Create a deep copy of positions to manipulate
    let tempPositions = JSON.parse(JSON.stringify(room.positions)) as Position[];
    
    // Create a map of candidates who are confirmed for a specific position
    const confirmedWinners = new Map<string, string>(); // positionId -> candidateId
    for (const candId in resolvedConflicts) {
        const chosenPosId = resolvedConflicts[candId];
        confirmedWinners.set(chosenPosId, candId);
    }
    
    // First pass: Disqualify candidates from positions they didn't win according to resolutions
    tempPositions.forEach(pos => {
      pos.candidates.forEach(cand => {
        const conflict = winnerConflicts.find(c => c.candidateId === cand.id);
        if (conflict) {
          const chosenPosId = resolvedConflicts[cand.id];
          // If the candidate is part of a conflict AND this isn't their chosen position, disqualify them
          if (pos.id !== chosenPosId) {
            cand.voteCount = -1; // Mark as disqualified for sorting
          }
        }
      });
    });
    
    // Second pass: Recalculate vote counts for display, but keep them disqualified for winner logic
    return tempPositions.map(pos => {
        return {
            ...pos,
            candidates: pos.candidates.map(cand => ({
                ...cand,
                // Reset voteCount for display, but the sorting has already happened based on -1
                voteCount: room.positions.find(p => p.id === pos.id)?.candidates.find(c => c.id === cand.id)?.voteCount || 0
            }))
        }
    });

  }, [room, resolvedConflicts, winnerConflicts, hasConfirmedResolutions]);


  const handleExportMarkdown = async () => {
    if (!room) return;
    setIsExporting(true);

    const positionsToExport = finalPositions || room.positions;
    const participants = room.finalized ? room.finalizedResults!.totalParticipants : totalCompletedVoters;

    let mdContent = `# 📊 Results for: ${room.title}\n\n`;
    mdContent += `*${room.description}*\n\n`;
    mdContent += `**Generated on:** ${new Date().toLocaleString()}\n\n`;
    mdContent += `**Room Status:** \`${room.status}\`\n\n`;
    mdContent += "---\n\n";

    if (room.roomType === 'review') {
        mdContent += `## Review Summary\n\n`;
        positionsToExport.forEach(position => {
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
      mdContent += `*Based on **${participants}** completed participant(s).*\n\n`;

      positionsToExport.forEach(position => {
        // Here we use the potentially modified vote counts from finalPositions
        const candidatesInPosition = finalPositions.find(p => p.id === position.id)?.candidates || position.candidates;
        const eligibleCandidates = candidatesInPosition.filter(c => (c.voteCount ?? -1) >= 0);
        const sortedCandidates = [...eligibleCandidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        const maxVotes = sortedCandidates.length > 0 ? (sortedCandidates[0].voteCount || 0) : 0;
        
        mdContent += `### ${position.title}\n\n`;
        mdContent += `| Rank | Candidate | Votes | Percentage |\n`;
        mdContent += `|:----:|:----------|:------|:-----------|\n`;
        
        sortedCandidates.forEach((candidate, index) => {
          const originalVoteCount = room.positions.find(p=>p.id === position.id)?.candidates.find(c=>c.id===candidate.id)?.voteCount || 0;
          const percentage = participants > 0 ? ((originalVoteCount / participants) * 100).toFixed(1) : "0.0";
          const isWinner = maxVotes > 0 && originalVoteCount === maxVotes;
          const rankDisplay = isWinner ? `🏆 ${index + 1}` : `${index + 1}`;
          mdContent += `| ${rankDisplay} | ${candidate.name} | ${originalVoteCount}/${participants} | ${percentage}% |\n`;
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


  if (loading) return <ResultsLoading />;
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
  if (!room) return notFound();

  const shareableResultsLink = `${baseUrl}/results/${room.id}`;
  const participantsCount = room.finalized ? room.finalizedResults!.totalParticipants : totalCompletedVoters;
  
  const conflictsResolved = winnerConflicts.length === 0 || hasConfirmedResolutions;
  const showFinalizeButton = room.status === 'closed' && !room.finalized && conflictsResolved;

  const renderResults = () => {
    if (room.roomType === 'review') {
        const positionsToDisplay = room.finalized ? room.finalizedResults?.positions || [] : room.positions;
        return (
            <div className="space-y-8">
                <ReviewResultsDisplay room={room} positions={positionsToDisplay} />
                <ReviewLeaderboard positions={positionsToDisplay} />
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Detailed Results</CardTitle>
                <CardDescription>
                Comprehensive breakdown of votes for each candidate. 
                Vote counts and percentages are based on the {participantsCount} participant(s) who completed the process.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResultsTable positions={finalPositions} totalCompletedVoters={participantsCount} room={room} />
            </CardContent>
        </Card>
    )
  }


  return (
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
            {room.roomType === 'review' && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Share2 className="mr-2 h-4 w-4" /> Share
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share Read-Only Results</DialogTitle>
                    <DialogDescription>
                      Anyone with this link can view the results for this review room.
                      The page is read-only and does not require a login.
                    </DialogDescription>
                  </DialogHeader>
                  <ShareableLinkDisplay voterLink={shareableResultsLink} />
                </DialogContent>
              </Dialog>
            )}
            <Button disabled={isExporting} className="w-full sm:w-auto" onClick={handleExportMarkdown}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                {isExporting ? 'Exporting...' : 'Export as .md'}
            </Button>
            {showFinalizeButton && (
              <FinalizeRoomDialog roomId={room.id} onFinalized={fetchRoomData} />
            )}
        </div>
      </div>

        {room.finalized ? (
            <Alert variant="default" className="border-green-600/50 bg-green-500/5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Results Finalized &amp; Anonymized</AlertTitle>
                <AlertDescription>
                The underlying votes/reviews for this room have been permanently deleted. The results shown are static.
                </AlertDescription>
            </Alert>
        ) : room.status === 'closed' && (
         <Alert variant="default" className="border-amber-600/50 bg-amber-500/5">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertTitle>Ready to Finalize</AlertTitle>
            <AlertDescription>
                {conflictsResolved ? (
                    "This election is complete. To ensure participant privacy, you can finalize and anonymize the results. This action is irreversible."
                ) : (
                    "This election is complete, but there are winner conflicts to resolve before you can finalize the results."
                )}
            </AlertDescription>
         </Alert>
       )}

      {room.status !== 'closed' && !room.finalized && (
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
      
      {winnerConflicts.length > 0 && !hasConfirmedResolutions && room.status === 'closed' && (
        <ConflictResolver conflicts={winnerConflicts} onResolve={handleConfirmResolutions} />
      )}

      {renderResults()}

    </div>
  );
}

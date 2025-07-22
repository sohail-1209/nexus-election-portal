
"use client";

import { useEffect, useState, useMemo, useCallback, FormEvent } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionRoomById, getVotersForRoom, declareWinner } from "@/lib/electionRoomService";
import type { ElectionRoom, Candidate, Position, Voter } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useNotificationStore } from "@/stores/notificationStore";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, BarChartHorizontalBig, AlertTriangle, Trophy, Loader2, MessageSquare, PieChart, Code, File, FileText, BadgeHelp, CheckCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ResultsTable from "@/components/app/admin/ResultsTable";
import ResultsCharts from "@/components/app/admin/ResultsCharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResultsLoading from "./loading";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import ResultsPdfLayout from "@/components/app/admin/ResultsPdfLayout";
import ReviewResultsDisplay from "@/components/app/admin/ReviewResultsDisplay";
import ReviewCharts from "@/components/app/admin/ReviewCharts";
import StarRating from "@/components/app/StarRating";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  const { toast } = useToast();
  const { triggerNotification } = useNotificationStore();
  
  const [room, setRoom] = useState<ElectionRoom | null>(null);
  const [totalCompletedVoters, setTotalCompletedVoters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<any>(null);
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
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

 const conflicts = useMemo(() => {
    if (!room || room.status !== 'closed' || room.roomType === 'review') {
      return { ties: [], multiWins: [], allConflictsResolved: true };
    }

    const unresolvedPositions = room.positions.filter(p => !p.winnerCandidateId);
    
    // Data structures for conflict detection
    const ties: { position: Position; candidates: Candidate[] }[] = [];
    const winsByCandidateName = new Map<string, { candidate: Candidate; positions: Position[] }>();

    // 1. Iterate through each unresolved position to find winners and ties
    for (const position of unresolvedPositions) {
      if (position.candidates.length === 0) continue;

      const sortedCandidates = [...position.candidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
      const topVoteCount = sortedCandidates[0]?.voteCount || 0;
      
      if (topVoteCount > 0) {
        const currentWinners = sortedCandidates.filter(c => (c.voteCount || 0) === topVoteCount);
        
        // Add all winners to the central wins tracker, keyed by candidate NAME for uniqueness
        for (const winner of currentWinners) {
          const existing = winsByCandidateName.get(winner.name) || { candidate: winner, positions: [] };
          // Avoid adding the same position twice if it's already there
          if (!existing.positions.some(p => p.id === position.id)) {
            existing.positions.push(position);
          }
          winsByCandidateName.set(winner.name, existing);
        }

        // Check for a tie within this specific position
        if (currentWinners.length > 1) {
          ties.push({ position, candidates: currentWinners });
        }
      }
    }
    
    // 2. Determine multi-wins from the populated map
    const multiWins = Array.from(winsByCandidateName.values())
      .filter(data => data.positions.length > 1)
      .map(data => ({
        candidateId: data.candidate.id, // We need one ID for resolution
        name: data.candidate.name,
        positions: data.positions,
      }));

    const allConflictsResolved = ties.length === 0 && multiWins.length === 0;

    return { ties, multiWins, allConflictsResolved };
  }, [room]);


  const openConflictDialog = (conflict: any) => {
    setCurrentConflict(conflict);
    setSelectedResolution(null);
    setIsConflictDialogOpen(true);
  };
  
  const handleConfirmResolution = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedResolution) {
        toast({ variant: "destructive", title: "No Selection", description: "Please select a resolution option." });
        return;
    }
    setIsConflictDialogOpen(false);
    setIsPasswordDialogOpen(true);
    setAdminPassword("");
    setShowPassword(false);
  }

  const handleResolveConflict = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentConflict || !selectedResolution || !room || !adminPassword) return;
    setIsResolving(true);
    
    let resolutionPromise;

    if (currentConflict.type === 'tie') {
      resolutionPromise = declareWinner(room.id, currentConflict.position.id, selectedResolution, adminPassword, {});
    } else if (currentConflict.type === 'multi-win') {
      // For multi-win, the resolution value is the position ID to keep.
      const winningPositionId = selectedResolution;
      
      // We need to find the correct candidate ID for the winning position.
      const winningPosition = currentConflict.positions.find((p: Position) => p.id === winningPositionId);
      const candidateInWinningPosition = winningPosition.candidates.find((c: Candidate) => c.name === currentConflict.name);
      
      if (!candidateInWinningPosition) {
        toast({ variant: 'destructive', title: "Resolution Failed", description: "Could not find the winning candidate in the selected position." });
        setIsResolving(false);
        setIsPasswordDialogOpen(false);
        return;
      }

      const candidateIdToWin = candidateInWinningPosition.id;

      const forfeitPromises = currentConflict.positions
        .filter((p: Position) => p.id !== winningPositionId)
        .map((p: Position) => declareWinner(room.id, p.id, 'forfeited', adminPassword, { forfeitedByCandidateName: currentConflict.name }));

      resolutionPromise = Promise.all([
        declareWinner(room.id, winningPositionId, candidateIdToWin, adminPassword, {}),
        ...forfeitPromises
      ]);
    } else {
        setIsResolving(false);
        return;
    }

    try {
      await resolutionPromise;
      toast({ title: "Conflict Resolved", description: "The winner has been officially recorded. Refreshing results..." });
      triggerNotification();
      await fetchRoomData(); // Re-fetch data to update UI
    } catch (error: any) {
      console.error("Error resolving conflict:", error);
      toast({ variant: 'destructive', title: "Resolution Failed", description: error.message || "Could not save the resolution. Please try again." });
    } finally {
      setIsResolving(false);
      setIsPasswordDialogOpen(false);
      setCurrentConflict(null);
    }
  };


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
        
        mdContent += `### ${position.title}\n\n`;
        mdContent += `| Rank | Candidate | Votes | Percentage |\n`;
        mdContent += `|:----:|:----------|:------|:-----------|\n`;
        
        sortedCandidates.forEach((candidate, index) => {
          const percentage = totalCompletedVoters > 0 ? (((candidate.voteCount || 0) / totalCompletedVoters) * 100).toFixed(1) : "0.0";
          const isWinner = candidate.isOfficialWinner || (conflicts.allConflictsResolved && index === 0 && (candidate.voteCount || 0) > 0);
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

  const handleExportPdf = async () => {
    if (!room) return;
    setIsExporting(true);

    const doc = new jsPDF();
    const title = `${room.title} - Results`;
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    doc.setProperties({ title: title });

    autoTable(doc, {
        body: [
            [{ content: room.title, styles: { fontSize: 18, fontStyle: 'bold', halign: 'center' } }],
            [{ content: room.description, styles: { fontSize: 12, halign: 'center' } }],
            [{ content: `Generated on: ${new Date().toLocaleString()}`, styles: { fontSize: 9, textColor: '#777', halign: 'center' } }],
        ],
        theme: 'plain',
        styles: {
            cellPadding: { top: 1, right: 0, bottom: 1, left: 0 },
            font: 'times',
        }
    });

    if (room.roomType === 'review') {
        room.positions.forEach((position, index) => {
            const startY = (doc as any).lastAutoTable.finalY + (index === 0 ? 15 : 20);

            autoTable(doc, {
                body: [
                    [{ content: `Review for: ${position.title} - ${position.candidates[0]?.name || ''}`, styles: { fontSize: 16, fontStyle: 'bold' } }],
                    [{ content: `Average Rating: ${position.averageRating?.toFixed(2) || 'N/A'} ★  |  Total Reviews: ${position.reviews?.length || 0}`, styles: { fontSize: 12 } }],
                ],
                theme: 'plain',
                styles: { font: 'times', cellPadding: { top: 0, right: 0, bottom: 0, left: 0 } },
                startY: startY,
            });

            if (position.reviews && position.reviews.length > 0) {
                 autoTable(doc, {
                    head: [['S.No', 'Feedback Received']],
                    body: (position.reviews || []).map((review, reviewIndex) => [reviewIndex + 1, review.feedback]),
                    startY: (doc as any).lastAutoTable.finalY + 10,
                    theme: 'grid',
                    headStyles: { fillColor: [0, 121, 107], textColor: [255, 255, 255], font: 'times' },
                    bodyStyles: { font: 'times' },
                    columnStyles: {
                        0: { cellWidth: 15, halign: 'center' },
                    },
                });
            } else {
                autoTable(doc, {
                    body: [['No feedback submitted for this position.']],
                    startY: (doc as any).lastAutoTable.finalY + 10,
                    theme: 'plain',
                });
            }
        });
    } else {
        const totalParticipants = totalCompletedVoters;
        room.positions.forEach((position, index) => {
            const sortedCandidates = [...position.candidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
            const startY = (doc as any).lastAutoTable.finalY + (index === 0 ? 15 : 20);

            autoTable(doc, {
                body: [[{ content: `Results for Position: ${position.title}`, styles: { fontSize: 16, fontStyle: 'bold' } }]],
                theme: 'plain',
                styles: { font: 'times', cellPadding: 0 },
                startY: startY,
            });

            const tableBody = sortedCandidates.map((candidate, idx) => {
                const percentage = totalParticipants > 0 ? (((candidate.voteCount || 0) / totalParticipants) * 100).toFixed(1) + "%" : "0.0%";
                const isWinner = candidate.isOfficialWinner;
                const rank = isWinner ? `🏆 ${idx + 1}` : `${idx + 1}`;
                return [rank, candidate.name, `${candidate.voteCount || 0}/${totalParticipants}`, percentage];
            });

             autoTable(doc, {
                head: [['Rank', 'Candidate Name', 'Votes Received', 'Vote Percentage']],
                body: tableBody,
                startY: (doc as any).lastAutoTable.finalY + 5,
                theme: 'grid',
                headStyles: { fillColor: [0, 121, 107], textColor: [255, 255, 255], font: 'times' },
                bodyStyles: { font: 'times' },
            });
        });
    }

    doc.save(`${safeTitle}.pdf`);
    setIsExporting(false);
  };

  const handleExportFinalReport = async () => {
    if (!room || room.roomType === 'review' || !conflicts.allConflictsResolved) return;
    setIsExporting(true);

    let mdContent = `# Official Election Report: ${room.title}\n\n`;
    mdContent += `This report was generated on **${new Date().toLocaleString()}** after the election room was closed and all conflicts were resolved.\n\n`;
    mdContent += `A total of **${totalCompletedVoters}** participant(s) completed the voting process.\n\n`;
    mdContent += "---\n\n";
    mdContent += "## Final Declared Winners\n\n";
    mdContent += "| S.No | Position | Winner | Votes Received |\n";
    mdContent += "|:----:|:---------|:-------|:---------------|\n";

    const officialWinners = room.positions
        .map(p => {
            const winner = p.candidates.find(c => c.isOfficialWinner);
            return winner ? { ...winner, positionTitle: p.title } : null;
        })
        .filter((w): w is Candidate & { positionTitle: string } => w !== null);

    officialWinners.forEach((winner, index) => {
        mdContent += `| ${index + 1} | ${winner.positionTitle} | ${winner.name} | ${winner.voteCount || 0} |\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = room.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}_official_report.md`;
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
              <Link href={`/admin/rooms/${roomId}/manage`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Manage
              </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!room) {
    return notFound();
  }

  const getConflictDialogDescription = () => {
    if (!currentConflict) return "";
    if (currentConflict.type === 'tie') {
      return 'Two or more candidates have the same number of votes. Please manually select one candidate as the official winner for this position.';
    }
    if (currentConflict.type === 'multi-win') {
      return `Candidate ${currentConflict.name} has won in multiple positions: ${currentConflict.positions.map((p: Position) => p.title).join(' and ')}. Please choose the preferred position to assign them as the final winner.`;
    }
    return "";
  };

  const isConflictInPosition = (positionId: string) => {
    const isInTie = conflicts.ties.some(t => t.position.id === positionId);
    const isInMultiWin = conflicts.multiWins.some(mw => mw.positions.some((p:Position) => p.id === positionId));
    return isInTie || isInMultiWin;
  }

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <Button variant="outline" asChild className="mb-2 sm:mb-0 sm:mr-4">
            <Link href={`/admin/rooms/${room.id}/manage`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Manage Room
            </Link>
            </Button>
            <h1 className="text-3xl font-bold font-headline mt-2">Results: {room.title}</h1>
            <p className="text-muted-foreground mt-2">{room.description}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button disabled={isExporting} className="w-full sm:w-auto">
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {isExporting ? 'Exporting...' : 'Export'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportPdf}>
                        <File className="mr-2 h-4 w-4" />
                        Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportMarkdown}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export as .md Code
                    </DropdownMenuItem>
                     {room.status === 'closed' && room.roomType === 'voting' && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleExportFinalReport} disabled={!conflicts.allConflictsResolved}>
                                <FileText className="mr-2 h-4 w-4 text-destructive" />
                                <span className="text-destructive">Export Official Report</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

       {room.status === 'closed' && room.roomType === 'voting' && !conflicts.allConflictsResolved && (
        <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BadgeHelp className="h-6 w-6 text-amber-600" />Conflict Resolution Required</CardTitle>
                <CardDescription>
                   The election has finished, but there are unresolved ties or multi-position wins. Please resolve these conflicts below to enable the final report export.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {conflicts.ties.map((tie: any, index: number) => (
                    <Alert key={`tie-${index}`} variant="destructive" className="border-rose-500/30 bg-rose-500/5">
                        <AlertTitle>Tie Detected in: {tie.position.title}</AlertTitle>
                        <AlertDescription>
                            The following candidates received the same number of votes: {tie.candidates.map((c: Candidate) => c.name).join(', ')}.
                             <Button size="sm" variant="destructive" className="ml-4" onClick={() => openConflictDialog({type: 'tie', ...tie})}>
                                Resolve Tie
                            </Button>
                        </AlertDescription>
                    </Alert>
                ))}
                {conflicts.multiWins.map((mw: any, index: number) => (
                     <Alert key={`mw-${index}`} variant="destructive" className="border-rose-500/30 bg-rose-500/5">
                        <AlertTitle>Multiple Wins Detected for: {mw.name}</AlertTitle>
                        <AlertDescription>
                           This candidate won multiple positions: {mw.positions.map((p: Position) => p.title).join(', ')}. Please select one position for them to hold.
                            <Button size="sm" variant="destructive" className="ml-4" onClick={() => openConflictDialog({type: 'multi-win', ...mw})}>
                                Resolve Multi-win
                            </Button>
                        </AlertDescription>
                    </Alert>
                ))}
            </CardContent>
        </Card>
      )}

       {room.status === 'closed' && room.roomType === 'voting' && conflicts.allConflictsResolved && (
         <Alert variant="default" className="border-green-600/50 bg-green-500/5">
           <CheckCircle className="h-4 w-4 text-green-600" />
           <AlertTitle>All Conflicts Resolved</AlertTitle>
           <AlertDescription>
             All ties and multiple-position wins have been resolved. The official report is now available for export.
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

      {room.roomType === 'review' ? (
         <Tabs defaultValue="charts" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex mb-4">
              <TabsTrigger value="charts" className="text-sm md:text-base"><PieChart className="mr-2 h-4 w-4"/>Charts View</TabsTrigger>
              <TabsTrigger value="feedback" className="text-sm md:text-base"><MessageSquare className="mr-2 h-4 w-4"/>Feedback View</TabsTrigger>
            </TabsList>
            <TabsContent value="charts" className="space-y-8">
                <ReviewCharts positions={room.positions} />
                <ReviewLeaderboard positions={room.positions} />
            </TabsContent>
            <TabsContent value="feedback">
                <ReviewResultsDisplay room={room} />
            </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="charts" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex mb-4">
            <TabsTrigger value="charts" className="text-sm md:text-base"><BarChartHorizontalBig className="mr-2 h-4 w-4"/>Charts View</TabsTrigger>
            <TabsTrigger value="table" className="text-sm md:text-base"><BarChartHorizontalBig className="mr-2 h-4 w-4"/>Table View</TabsTrigger>
          </TabsList>
          <TabsContent value="charts" className="space-y-8">
            <ResultsCharts positions={room.positions} />
          </TabsContent>
          <TabsContent value="table" className="space-y-8">
              <Card>
                  <CardHeader>
                      <CardTitle>Detailed Results Table</CardTitle>
                      <CardDescription>
                        Comprehensive breakdown of votes for each candidate. 
                        Vote counts and percentages are based on the {totalCompletedVoters} participant(s) who completed the process.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <ResultsTable positions={room.positions} totalCompletedVoters={totalCompletedVoters} isConflictInPosition={isConflictInPosition} />
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>

    {/* Conflict Resolution Dialog - Step 1: Select Resolution */}
    <AlertDialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
        <AlertDialogContent asChild>
          <form onSubmit={handleConfirmResolution}>
            <AlertDialogHeader>
            <AlertDialogTitle>
                Resolve Election Conflict: {currentConflict?.type === 'tie' ? `Tie in ${currentConflict.position.title}` : `Multiple Wins for ${currentConflict?.name}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
                {getConflictDialogDescription()}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-4">
                <RadioGroup value={selectedResolution || ''} onValueChange={setSelectedResolution}>
                    {currentConflict?.type === 'tie' && currentConflict.candidates.map((c: Candidate) => (
                        <div key={c.id} className="flex items-center space-x-2">
                           <RadioGroupItem value={c.id} id={`res-${c.id}`} />
                           <Label htmlFor={`res-${c.id}`} className="flex-grow">{c.name} ({c.voteCount} votes)</Label>
                        </div>
                    ))}
                    {currentConflict?.type === 'multi-win' && currentConflict.positions.map((p: Position) => (
                         <div key={p.id} className="flex items-center space-x-2">
                           <RadioGroupItem value={p.id} id={`res-${p.id}`} />
                           <Label htmlFor={`res-${p.id}`}>{p.title}</Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={!selectedResolution}>
                  Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
    </AlertDialog>

    {/* Password Confirmation Dialog - Step 2 */}
    <AlertDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <AlertDialogContent asChild>
          <form onSubmit={handleResolveConflict}>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Resolution</AlertDialogTitle>
                <AlertDialogDescription>
                    Please enter your account password to confirm this change. This action is final and cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="admin-password">Your Admin Password</Label>
                <div className="relative">
                <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter password to confirm"
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
              <AlertDialogCancel onClick={() => setCurrentConflict(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={isResolving || !adminPassword}>
                  {isResolving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Declare Winner
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
    </AlertDialog>


    <div className="hidden">
      <ResultsPdfLayout room={room} totalCompletedVoters={totalCompletedVoters} />
    </div>
    </>
  );
}

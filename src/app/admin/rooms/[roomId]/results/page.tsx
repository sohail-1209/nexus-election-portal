
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionRoomById, getVotersForRoom } from "@/lib/electionRoomService";
import type { ElectionRoom, Candidate, Position, Voter } from "@/lib/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, BarChartHorizontalBig, AlertTriangle, Trophy, Loader2, MessageSquare, PieChart, Code } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ResultsTable from "@/components/app/admin/ResultsTable";
import ResultsCharts from "@/components/app/admin/ResultsCharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResultsLoading from "./loading";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from 'jspdf-autotable';
import ResultsPdfLayout from "@/components/app/admin/ResultsPdfLayout";
import ReviewResultsDisplay from "@/components/app/admin/ReviewResultsDisplay";
import ReviewCharts from "@/components/app/admin/ReviewCharts";
import StarRating from "@/components/app/StarRating";

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

  useEffect(() => {
    if (!roomId) {
        setError("Room ID is missing from the URL.");
        setLoading(false);
        return;
    };
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
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
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [roomId, router]);

  const handleExportMarkdown = () => {
    if (!room) return;

    let mdContent = `# Results for: ${room.title}\n\n`;
    mdContent += `**Description:** ${room.description}\n`;
    mdContent += `**Generated on:** ${new Date().toLocaleString()}\n\n`;

    if (room.roomType === 'review') {
      mdContent += `## Review Results\n\n`;
      room.positions.forEach(position => {
        mdContent += `### ${position.title} - ${position.candidates[0]?.name || 'N/A'}\n`;
        mdContent += `- **Average Rating:** ${position.averageRating?.toFixed(2) || 'N/A'} ★\n`;
        mdContent += `- **Total Reviews:** ${position.reviews?.length || 0}\n\n`;
        mdContent += `#### Feedback:\n\n`;
        if (position.reviews && position.reviews.length > 0) {
            position.reviews.forEach((review, index) => {
                mdContent += `${index + 1}. ${review.feedback}\n`;
            });
        } else {
            mdContent += `_No feedback submitted._\n`;
        }
        mdContent += `\n---\n\n`;
      });
    } else {
      mdContent += `## Voting Results\n\n`;
      mdContent += `*Based on **${totalCompletedVoters}** completed participant(s).*\n\n`;

      room.positions.forEach(position => {
        const sortedCandidates = [...position.candidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        mdContent += `### ${position.title}\n\n`;
        mdContent += `| Rank | Candidate | Votes | % of Total |\n`;
        mdContent += `|:----:|:----------|:------|:----------:|\n`;
        
        sortedCandidates.forEach((candidate, index) => {
          const percentage = totalCompletedVoters > 0 ? (((candidate.voteCount || 0) / totalCompletedVoters) * 100).toFixed(1) : "0.0";
          mdContent += `| ${index + 1} | ${candidate.name} | ${candidate.voteCount || 0}/${totalCompletedVoters} | ${percentage}% |\n`;
        });
        mdContent += `\n`;
      });
    }

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = room.title.replace(/[^a-z0-n]/gi, '_').toLowerCase();
    link.download = `${safeTitle}_results.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!room) return;
    setIsExporting(true);

    const doc = new jsPDF();
    const title = `${room.title} - Results`;
    const safeTitle = title.replace(/[^a-z0-n]/gi, '_').toLowerCase();

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
            if (index > 0) {
                doc.addPage();
            }

            const startY = index === 0 ? (doc as any).lastAutoTable.finalY + 5 : 15;

            autoTable(doc, {
                body: [
                    [{ content: `Review for: ${position.title} - ${position.candidates[0]?.name || ''}`, styles: { fontSize: 16, fontStyle: 'bold' } }],
                    [{ content: `Average Rating: ${position.averageRating?.toFixed(2) || 'N/A'} ★`, styles: { fontSize: 12 } }],
                ],
                theme: 'plain',
                styles: { font: 'times', cellPadding: { top: 0, right: 0, bottom: 0, left: 0 } },
                startY: startY,
            });

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
        });
    } else {
        const tableOptions: UserOptions = {
            html: '#pdf-results-table',
            startY: (doc as any).lastAutoTable.finalY + 10,
            theme: 'grid',
            headStyles: { fillColor: [0, 121, 107], font: 'times', textColor: [255, 255, 255] },
            bodyStyles: { font: 'times' },
            didParseCell: (data) => {
                if (data.cell.raw instanceof HTMLElement) {
                    if (data.cell.raw.querySelector('img')) {
                        data.cell.text = '';
                    }
                }
                if (data.row.raw instanceof HTMLElement && data.row.raw.classList.contains('winner-row')) {
                    data.cell.styles.fillColor = 'transparent';
                    data.cell.styles.textColor = 'black';
                }
            }
        };
        autoTable(doc, tableOptions);
    }

    doc.save(`${safeTitle}.pdf`);
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
            <p className="text-muted-foreground">{room.description}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={handleExportPdf} disabled={isExporting} className="w-full sm:w-auto">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isExporting ? 'Exporting...' : 'Export as PDF'}
            </Button>
             <Button onClick={handleExportMarkdown} variant="outline" className="w-full sm:w-auto">
              <Code className="mr-2 h-4 w-4" />
              Export .md Code
            </Button>
        </div>
      </div>

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
                      <ResultsTable positions={room.positions} totalCompletedVoters={totalCompletedVoters} />
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
    <div className="hidden">
      <ResultsPdfLayout room={room} totalCompletedVoters={totalCompletedVoters} />
    </div>
    </>
  );
}

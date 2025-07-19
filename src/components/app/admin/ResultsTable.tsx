
import type { Position } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award } from "lucide-react";

interface ResultsTableProps {
  positions: Position[];
  totalCompletedVoters: number;
}

export default function ResultsTable({ positions, totalCompletedVoters }: ResultsTableProps) {
  if (!positions || positions.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No positions or results to display.</p>;
  }

  return (
    <div className="space-y-8">
      {positions.map((position) => {
        const sortedCandidates = [...position.candidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        const maxVotes = sortedCandidates.length > 0 ? (sortedCandidates[0].voteCount || 0) : 0;
        
        return (
          <div key={position.id}>
            <h3 className="text-xl font-semibold mb-3 font-headline">{position.title}</h3>
            <Table className="border rounded-lg shadow-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead className="w-[100px]">Image</TableHead>
                  <TableHead>Candidate Name</TableHead>
                  <TableHead className="text-right">Votes</TableHead>
                  <TableHead className="text-right w-[120px]">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCandidates.map((candidate, index) => {
                  const percentage = totalCompletedVoters > 0 ? (((candidate.voteCount || 0) / totalCompletedVoters) * 100).toFixed(1) : "0.0";
                  const isWinner = (candidate.voteCount || 0) === maxVotes && maxVotes > 0;
                  
                  return (
                    <TableRow key={candidate.id} className={candidate.isOfficialWinner ? "bg-green-600/10" : (isWinner ? "bg-primary/10" : "")}>
                      <TableCell className="font-medium text-center">
                        {candidate.isOfficialWinner ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white">
                                <Award className="h-3 w-3 mr-1" /> Official Winner
                            </Badge>
                        ) : isWinner ? (
                            <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white">
                                <Trophy className="h-3 w-3 mr-1" /> {index + 1}
                            </Badge>
                        ) : (
                            index + 1
                        )}
                      </TableCell>
                      <TableCell>
                        <Image
                          src={candidate.imageUrl || `https://placehold.co/60x60.png?text=${candidate.name.charAt(0)}`}
                          alt={candidate.name}
                          width={40}
                          height={40}
                          className="rounded-full object-cover aspect-square"
                          data-ai-hint="person portrait"
                        />
                      </TableCell>
                      <TableCell>{candidate.name}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {`${candidate.voteCount || 0} / ${totalCompletedVoters}`}
                      </TableCell>
                      <TableCell className="text-right">{percentage}%</TableCell>
                    </TableRow>
                  );
                })}
                {sortedCandidates.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No candidates or votes for this position.</TableCell>
                    </TableRow>
                )}
              </TableBody>
               {sortedCandidates.length > 0 && (
                 <TableCaption className="py-2 text-sm">Results for {position.title}. Total completed participants: {totalCompletedVoters}</TableCaption>
               )}
            </Table>
          </div>
        );
      })}
    </div>
  );
}

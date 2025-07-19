
import type { ElectionRoom, Candidate } from "@/lib/types";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ResultsPdfLayoutProps {
    room: ElectionRoom | null;
    totalCompletedVoters?: number;
}

export default function ResultsPdfLayout({ room, totalCompletedVoters }: ResultsPdfLayoutProps) {
    if (!room) {
        return null;
    }

    return (
        <div id="pdf-content">
            {/* This table contains the detailed breakdown per position */}
            <table id="pdf-results-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Rank</th>
                        <th>Candidate</th>
                        <th>Votes</th>
                    </tr>
                </thead>
                <tbody>
                    {room.positions.map((position) => {
                        const sortedCandidates = [...position.candidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
                        const maxVotes = sortedCandidates.length > 0 ? (sortedCandidates[0].voteCount || 0) : 0;
                        
                        return sortedCandidates.map((candidate, index) => {
                             const isWinner = (candidate.voteCount || 0) === maxVotes && maxVotes > 0;
                             
                             return (
                                <tr key={candidate.id} className={cn(isWinner && 'winner-row')}>
                                    {index === 0 && (
                                        <td rowSpan={sortedCandidates.length}>
                                            {position.title}
                                        </td>
                                    )}
                                    <td>{index + 1}{isWinner ? ' (Winner)' : ''}</td>
                                    <td>{candidate.name}</td>
                                    <td>{`${candidate.voteCount || 0} / ${totalCompletedVoters || position.candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0)}`}</td>
                                </tr>
                             )
                        });
                    })}
                </tbody>
            </table>
        </div>
    );
}

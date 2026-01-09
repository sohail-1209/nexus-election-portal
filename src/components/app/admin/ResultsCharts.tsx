
"use client";

import type { Position } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts"; 
import { useMemo } from "react";

interface ResultsChartsProps {
  positions: Position[];
  totalCompletedVoters: number;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted))", // Color for abstained votes
];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
  if (percent * 100 < 5 || name === "Abstained") return null; // Don't render label if slice is too small or for abstained

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


export default function ResultsCharts({ positions, totalCompletedVoters }: ResultsChartsProps) {
  const chartDataByPosition = useMemo(() => {
    return positions.map(position => {
      const votesForPosition = position.candidates.reduce((sum, cand) => sum + (cand.voteCount || 0), 0);
      const abstainedVotes = totalCompletedVoters - votesForPosition;

      // The name/value structure is required for pie charts
      const candidatesData = position.candidates.map((candidate, index) => ({
        name: candidate.name,
        value: candidate.voteCount || 0,
      })).filter(c => c.value > 0); // Only include candidates with votes

      if (abstainedVotes > 0) {
        candidatesData.push({
          name: "Abstained",
          value: abstainedVotes,
        });
      }

      return {
        positionTitle: position.title,
        candidatesData,
      };
    });
  }, [positions, totalCompletedVoters]);

  if (!positions || positions.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No positions or results to display charts for.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {chartDataByPosition.map(({ positionTitle, candidatesData }) => {
        const hasVotes = candidatesData.some(d => d.name !== 'Abstained');
        
        return (
          <Card key={positionTitle} className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-headline">{positionTitle} - Vote Distribution</CardTitle>
              <CardDescription>
                A visual representation of votes for each candidate in this position, out of {totalCompletedVoters} total participant(s).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {candidatesData.length > 0 && hasVotes ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number, name: string) => [`${value} vote(s) out of ${totalCompletedVoters}`, name]}
                    />
                    <Legend 
                      iconSize={10} 
                      wrapperStyle={{
                        fontSize: '14px',
                        lineHeight: '20px',
                      }}
                    />
                    <Pie
                      data={candidatesData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      labelLine={false}
                      label={renderCustomizedLabel}
                    >
                      {candidatesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Abstained' ? "hsl(var(--muted))" : CHART_COLORS[index % (CHART_COLORS.length - 1)]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center">
                  <p className="text-muted-foreground text-center py-4">No votes have been cast for this position yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  );
}

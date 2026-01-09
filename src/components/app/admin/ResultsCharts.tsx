
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
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(174 100% 20%)",
  "hsl(174 100% 28%)",
  "hsl(174 100% 32%)",
];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent * 100 < 5) return null; // Don't render label if slice is too small

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


export default function ResultsCharts({ positions }: ResultsChartsProps) {
  const chartDataByPosition = useMemo(() => {
    return positions.map(position => ({
      positionTitle: position.title,
      // The name/value structure is required for pie charts
      candidatesData: position.candidates.map((candidate, index) => ({
        name: candidate.name,
        value: candidate.voteCount || 0,
      })).filter(c => c.value > 0), // Only include candidates with votes
    }));
  }, [positions]);

  if (!positions || positions.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No positions or results to display charts for.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {chartDataByPosition.map(({ positionTitle, candidatesData }) => {
        const totalVotes = candidatesData.reduce((sum, entry) => sum + entry.value, 0);
        
        return (
          <Card key={positionTitle} className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-headline">{positionTitle} - Vote Distribution</CardTitle>
              <CardDescription>
                A visual representation of votes for each candidate in this position. Total votes: {totalVotes}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {candidatesData.length > 0 ? (
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
                      formatter={(value: number, name: string) => [`${value} vote(s)`, name]}
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
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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

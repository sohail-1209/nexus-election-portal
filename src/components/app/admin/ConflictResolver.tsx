
"use client";

import { useState, useMemo } from 'react';
import type { Position, Candidate } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Check, ArrowRight, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type WinnerConflict = {
  candidateId: string;
  candidateName: string;
  wonPositions: { positionId: string; positionTitle: string }[];
};

interface ConflictResolverProps {
  conflicts: WinnerConflict[];
  onResolve: (resolutions: Record<string, string>) => void;
}

export default function ConflictResolver({ conflicts, onResolve }: ConflictResolverProps) {
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleResolutionChange = (candidateId: string, positionId: string) => {
    setResolutions(prev => ({
      ...prev,
      [candidateId]: positionId,
    }));
  };

  const allConflictsHaveSelection = useMemo(() => {
    if (conflicts.length === 0) return true;
    return conflicts.every(c => resolutions[c.candidateId]);
  }, [conflicts, resolutions]);

  const handleSubmit = () => {
    if (!allConflictsHaveSelection) {
        toast({
            variant: 'destructive',
            title: 'Incomplete Resolutions',
            description: 'Please resolve all conflicts before confirming.'
        });
        return;
    }
    onResolve(resolutions);
     toast({
        title: 'Conflicts Selections Applied',
        description: 'The result table has been updated. If new conflicts arose, they will be shown. If not, you may now finalize.'
    });
  };

  return (
    <Card className="border-amber-500 bg-amber-500/5 shadow-xl">
        <CardHeader>
            <div className="flex items-start gap-4">
                 <div className="text-amber-600 mt-1">
                    <ShieldAlert className="h-8 w-8" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-headline text-amber-800 dark:text-amber-300">Winner Conflicts Detected</CardTitle>
                    <CardDescription className="text-amber-700 dark:text-amber-400">
                        One or more candidates have won in multiple positions. You must choose their definitive winning position to finalize the results. New conflicts may appear after you apply your selections.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-4">
                {conflicts.map(conflict => (
                    <div key={conflict.candidateId} className="border bg-background/50 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex-grow">
                            <p className="font-semibold">{conflict.candidateName}</p>
                            <p className="text-sm text-muted-foreground">
                                Has won: {conflict.wonPositions.map(p => `"${p.positionTitle}"`).join(' and ')}
                            </p>
                        </div>
                        <div className="w-full sm:w-64 flex-shrink-0">
                             <Select
                                value={resolutions[conflict.candidateId] || ""}
                                onValueChange={(value) => handleResolutionChange(conflict.candidateId, value)}
                             >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose final position..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {conflict.wonPositions.map(p => (
                                        <SelectItem key={p.positionId} value={p.positionId}>
                                            {p.positionTitle}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ))}
            </div>
            <Alert variant="default" className="border-primary/30">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>How this works</AlertTitle>
                <AlertDescription>
                    When you select a final position for a candidate, they will be removed as the winner from the other positions. The candidate with the next highest vote count in those vacated positions will be declared the new winner. This may create new conflicts to resolve.
                </AlertDescription>
            </Alert>
            <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={!allConflictsHaveSelection}>
                    <Check className="mr-2 h-4 w-4" />
                    Apply Selections
                </Button>
            </div>
        </CardContent>
    </Card>
  );
}

    
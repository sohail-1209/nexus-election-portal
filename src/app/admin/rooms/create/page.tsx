
"use client";

import ElectionRoomForm from '@/components/app/admin/ElectionRoomForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getBranches } from '@/lib/branchService';
import { Branch } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function CreateElectionRoomPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBranches() {
      try {
        const branchesData = await getBranches();
        setBranches(branchesData);
      } catch (error) {
        console.error("Failed to fetch branches", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBranches();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="outline" asChild className="mb-4">
        <Link href="/admin/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Panel
        </Link>
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Create New Voting Room</CardTitle>
          <CardDescription>Define the details for your new voting room.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading Branches...</p>
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center space-y-4">
                <p className="text-muted-foreground">You must create a branch before you can create a voting room.</p>
                 <Button asChild>
                    <Link href="/admin/dashboard">Go to Dashboard to Create a Branch</Link>
                </Button>
            </div>
          ) : (
            <ElectionRoomForm branches={branches} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

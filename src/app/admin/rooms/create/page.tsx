
"use client";

import ElectionRoomForm from '@/components/app/admin/ElectionRoomForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';

export default function CreateElectionRoomPage() {
  const searchParams = useSearchParams();
  const panelId = searchParams.get('panelId');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="outline" asChild className="mb-4">
        <Link href={panelId ? `/admin/panels/${panelId}` : "/admin/dashboard"}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Panel
        </Link>
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Create New Voting Room</CardTitle>
          <CardDescription>Define the details for your new voting room.</CardDescription>
        </CardHeader>
        <CardContent>
          <ElectionRoomForm panelId={panelId} />
        </CardContent>
      </Card>
    </div>
  );
}

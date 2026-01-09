
"use client";

import ElectionRoomForm from '@/components/app/admin/ElectionRoomForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CreateElectionRoomPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="outline" asChild className="mb-4">
        <Link href="/admin/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Create New Voting Room</CardTitle>
          <CardDescription>Define the details for your new voting room.</CardDescription>
        </CardHeader>
        <CardContent>
          <ElectionRoomForm />
        </CardContent>
      </Card>
    </div>
  );
}

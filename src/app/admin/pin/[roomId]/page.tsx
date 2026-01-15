
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionRoomById, pinResultsToHome } from "@/lib/electionRoomService";
import type { ElectionRoom, LeadershipRole } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, CalendarIcon, Loader2, Pin, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format, add } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";


const leadershipRoleSchema = z.object({
    id: z.string(),
    positionTitle: z.string(),
    holderName: z.string().min(1, "Winner's name is required."),
    roleType: z.enum(['Authority', 'Lead']),
});

const pinFormSchema = z.object({
  startDate: z.date({ required_error: "A start date is required." }),
  endDate: z.date({ required_error: "An end date is required." }),
  roles: z.array(leadershipRoleSchema).min(1, "At least one leadership role is required."),
});

type PinFormValues = z.infer<typeof pinFormSchema>;

function PinToHomeSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-10 w-48" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    {[...Array(3)].map(i => (
                        <div key={i} className="space-y-2">
                             <Skeleton className="h-5 w-1/4" />
                             <Skeleton className="h-10 w-full" />
                        </div>
                    ))}
                    <Skeleton className="h-12 w-full mt-4" />
                </CardContent>
            </Card>
        </div>
    )
}

export default function PinToHomePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<ElectionRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const form = useForm<PinFormValues>({
    resolver: zodResolver(pinFormSchema),
    defaultValues: {
      roles: [],
    },
  });
  
  const { fields } = useFieldArray({
    control: form.control,
    name: "roles",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const roomData = await getElectionRoomById(roomId, { withVoteCounts: true });
          if (!roomData) {
            notFound();
            return;
          }
          if (!roomData.finalized || roomData.pinnedToTerm) {
             setError(roomData.pinnedToTerm 
                ? "This room's results have already been pinned to the dashboard."
                : "This room's results must be finalized before they can be pinned."
             );
             setRoom(roomData);
             setLoading(false);
             return;
          }
          setRoom(roomData);

          const authorityTitles = ["President", "Vice President", "Technical Manager", "Event Manager", "Workshop Manager", "PR Manager", "General Secretary"];

          const roles: LeadershipRole[] = (roomData.finalizedResults?.positions || []).map(p => {
             const maxVotes = Math.max(...(p.candidates.map(c => c.voteCount || 0)));
             const winner = p.candidates.find(c => c.voteCount === maxVotes && maxVotes > 0);
             return {
                 id: p.id,
                 positionTitle: p.title,
                 holderName: winner?.name || '',
                 roleType: authorityTitles.includes(p.title) ? 'Authority' : 'Lead',
             };
          });

          form.reset({
              roles: roles,
              startDate: new Date(),
              endDate: add(new Date(), { months: 6 }),
          });

        } catch (err: any) {
            console.error("Failed to fetch room for pinning:", err);
            setError("An unexpected error occurred while loading the data.");
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [roomId, router, form]);

  const onSubmit = async (values: PinFormValues) => {
    if (!room) return;

    const termData = {
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        roles: values.roles,
        sourceRoomId: room.id,
        sourceRoomTitle: room.title,
    };
    
    const result = await pinResultsToHome(termData);
    if(result.success) {
        toast({
            title: "Results Pinned!",
            description: "The leadership structure has been published to the home dashboard.",
        });
        router.push('/');
    } else {
        toast({
            variant: "destructive",
            title: "Pinning Failed",
            description: result.message,
        });
    }
  }

  if (loading) {
    return <PinToHomeSkeleton />;
  }

  if (error) {
     return (
        <div className="max-w-4xl mx-auto space-y-6">
             <Button variant="outline" asChild>
                <Link href={`/admin/rooms/${roomId}/results`}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
                </Link>
            </Button>
            <Card className="shadow-xl border-destructive">
                <CardHeader>
                    <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
                        <AlertTriangle className="h-10 w-10" />
                    </div>
                    <CardTitle className="text-destructive text-center">Cannot Pin Results</CardTitle>
                    <CardDescription className="text-center">{error}</CardDescription>
                </CardHeader>
            </Card>
        </div>
     )
  }

  if (!room) {
    return notFound();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="outline" asChild>
        <Link href={`/admin/rooms/${roomId}/results`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
        </Link>
      </Button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-headline flex items-center">
                <Pin className="mr-3 h-7 w-7 text-primary" />
                Pin Results to Home Dashboard
              </CardTitle>
              <CardDescription>
                Confirm the winners and set the term duration to publish the leadership structure for <span className="font-semibold">{room.title}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Term Duration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Term Start Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Term End Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-4">Leadership Roles</h3>
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Confirm Winners</AlertTitle>
                    <AlertDescription>
                        The winners have been pre-filled based on vote counts. Please verify and edit if necessary before pinning.
                    </AlertDescription>
                </Alert>
                <div className="space-y-4 mt-4">
                    {fields.map((field, index) => (
                        <Card key={field.id} className="bg-muted/30">
                            <CardContent className="p-4">
                                <FormField
                                    control={form.control}
                                    name={`roles.${index}.holderName`}
                                    render={({ field: inputField }) => (
                                        <FormItem>
                                            <FormLabel>{field.positionTitle}</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter winner's name" {...inputField} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Pin className="mr-2 h-5 w-5" />}
                Confirm and Publish to Dashboard
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}

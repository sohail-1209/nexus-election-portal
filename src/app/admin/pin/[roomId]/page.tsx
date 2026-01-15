
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { getElectionRoomById, pinResultsToHome, getLatestTerm } from "@/lib/electionRoomService";
import type { ElectionRoom, LeadershipRole, Term } from "@/lib/types";
import { clubAuthorities } from "@/lib/roles";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ArrowLeft, CalendarIcon, Loader2, Pin, AlertTriangle, ShieldAlert, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format, add } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";


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
                    {[...Array(3)].map((_, i) => (
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showTermAlert, setShowTermAlert] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPasswordState] = useState(false);

  const [formValues, setFormValues] = useState<PinFormValues | null>(null);
  
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
          if (!roomData.finalized) {
             setError("This room's results must be finalized before they can be pinned.");
             setRoom(roomData);
             setLoading(false);
             return;
          }
          setRoom(roomData);

          const roles: LeadershipRole[] = (roomData.finalizedResults?.positions || []).map(p => {
             const maxVotes = Math.max(...(p.candidates.map(c => c.voteCount || 0)));
             const winner = p.candidates.find(c => c.voteCount === maxVotes && maxVotes > 0);
             return {
                 id: p.id,
                 positionTitle: p.title,
                 holderName: winner?.name || '',
                 roleType: clubAuthorities.includes(p.title) ? 'Authority' : 'Lead',
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
  
  const handleFinalSubmission = async (isNewTerm: boolean) => {
    if (!room || !formValues) return;
    setIsSubmitting(true);
    
    const termData = {
        startDate: formValues.startDate.toISOString(),
        endDate: formValues.endDate.toISOString(),
        roles: formValues.roles,
        sourceRoomId: room.id,
        sourceRoomTitle: room.title,
    };
    
    const result = await pinResultsToHome(termData, isNewTerm);
    
    if(result.success) {
        toast({
            title: "Results Pinned!",
            description: result.message,
        });
        router.push('/admin/dashboard');
    } else {
        toast({
            variant: "destructive",
            title: "Pinning Failed",
            description: result.message,
        });
    }
    setIsSubmitting(false);
  }

  const onSubmit = (values: PinFormValues) => {
    setFormValues(values);
    setShowPasswordDialog(true);
  };
  
  const handlePasswordConfirmation = async () => {
    const user = auth.currentUser;
    if (!user || !user.email || !formValues) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You are not logged in." });
        return;
    }
    
    setIsSubmitting(true);
    const credential = EmailAuthProvider.credential(user.email, password);
    
    try {
        await reauthenticateWithCredential(user, credential);
        
        setShowPasswordDialog(false);
        setPassword('');
        
        const latestTerm = await getLatestTerm();
        if (latestTerm) {
            const formStart = formValues.startDate.setHours(0,0,0,0);
            const formEnd = formValues.endDate.setHours(0,0,0,0);
            const termStart = new Date(latestTerm.startDate).setHours(0,0,0,0);
            const termEnd = new Date(latestTerm.endDate).setHours(0,0,0,0);

            if (formStart !== termStart || formEnd !== termEnd) {
                setShowTermAlert(true);
                setIsSubmitting(false);
                return;
            }
        }
        await handleFinalSubmission(false); // Same dates or no existing term, so merge.

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Password Incorrect",
            description: "The password you entered is incorrect. Please try again.",
        });
    } finally {
        if (!showTermAlert) { // Do not set loading to false if we are showing another dialog
             setIsSubmitting(false);
        }
    }
  };


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

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Pin className="mr-2 h-5 w-5" />}
                Confirm and Publish to Dashboard
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

       <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Confirm Your Identity</DialogTitle>
                <DialogDescription>
                To perform this sensitive action, please enter your password.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label htmlFor="admin-password-pin">
                        Enter your password to confirm
                    </Label>
                    <div className="relative">
                        <Input
                            id="admin-password-pin"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoFocus
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPasswordState((prev) => !prev)}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                        </Button>
                    </div>
                </div>
            </div>
            <DialogFooter className="sm:justify-end gap-2">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <Button
                    type="button"
                    onClick={handlePasswordConfirmation}
                    disabled={isLoading || password.length < 6}
                >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={showTermAlert} onOpenChange={setShowTermAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Leadership Term?</AlertDialogTitle>
            <AlertDialogDescription>
              <Alert variant="destructive" className="mt-4">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Warning!</AlertTitle>
                  <AlertDescription>
                    The term dates you've selected are different from the currently active term. Continuing will **clear all existing positions** from the dashboard and create a new term.
                  </AlertDescription>
              </Alert>
               <div className="mt-4 text-sm">
                This action cannot be undone. Do you wish to proceed?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFormValues(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleFinalSubmission(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Create New Term
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}


"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { ElectionRoom, Branch } from "@/lib/types"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2, Loader2, GripVertical } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebaseClient"; 
import { doc, setDoc, addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { facultyRoles, clubAuthorities, clubOperationTeam, generalClubRoles } from "@/lib/roles";

const candidateSchema = z.object({
  id: z.string().optional(), 
  name: z.string().min(1, "Candidate name is required."),
  voteCount: z.number().optional(),
});

const positionSchema = z.object({
  id: z.string().optional(), 
  title: z.string().min(1, "Position title is required."),
  candidates: z.array(candidateSchema).min(1).max(1, "Only one candidate is allowed per position in a review room."),
});

const reviewRoomFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  branchId: z.string().min(1, { message: "Please select a branch for this room." }),
  positions: z.array(positionSchema).min(1, "At least one position is required."),
  status: z.enum(["pending", "active", "closed"]).optional(),
}).refine(data => {
    const titles = data.positions.map(p => p.title.toLowerCase().trim());
    const uniqueTitles = new Set(titles);
    return uniqueTitles.size === titles.length;
}, {
    message: "Each position must be unique.",
    path: ["positions"],
});


type ReviewRoomFormValues = z.infer<typeof reviewRoomFormSchema>;

interface ReviewRoomFormProps {
  initialData?: ElectionRoom;
  branches: Branch[];
}

const generateClientSideId = (prefix: string = "item") => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

export default function ReviewRoomForm({ initialData, branches }: ReviewRoomFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFormMounted, setIsFormMounted] = useState(false);

  const form = useForm<ReviewRoomFormValues>({
    resolver: zodResolver(reviewRoomFormSchema),
    defaultValues: initialData ? {
      title: initialData.title || "",
      description: initialData.description || "",
      branchId: initialData.branchId || "",
      status: initialData.status || "pending",
      positions: (initialData.positions || []).map(p => ({
        id: p.id,
        title: p.title || "",
        candidates: (p.candidates || []).map(c => ({
          id: c.id,
          name: c.name || "",
          voteCount: c.voteCount || 0,
        })),
      })),
    } : {
      title: "",
      description: "",
      branchId: "",
      status: "pending",
      positions: [],
    },
  });
  
  const { fields: positionFields, append: appendPosition, remove: removePosition } = useFieldArray({
    control: form.control,
    name: "positions",
  });
  
  useEffect(() => {
    setIsFormMounted(true);
    if (!initialData && positionFields.length === 0 && form.formState.isMounted) {
      appendPosition({
        id: generateClientSideId('pos'),
        title: "",
        candidates: [{
          id: generateClientSideId('cand'),
          name: "",
        }]
      });
    }
  }, [initialData, appendPosition, positionFields.length, form.formState.isMounted]);
  
  async function onSubmit(values: ReviewRoomFormValues) {
    setIsLoading(true);

    const firestoreReadyPositions = values.positions.map(p => ({
        id: p.id || generateClientSideId('pos'),
        title: p.title,
        candidates: p.candidates.map(c => ({
            id: c.id || generateClientSideId('cand'),
            name: c.name,
        })),
    }));

    const dataToSave: any = { 
      title: values.title,
      description: values.description,
      branchId: values.branchId,
      isAccessRestricted: false,
      accessCode: null,
      positions: firestoreReadyPositions,
      status: values.status || 'pending',
      roomType: 'review',
    };
    
    try {
      if (initialData?.id) {
        const roomRef = doc(db, "electionRooms", initialData.id);
        await setDoc(roomRef, {
          ...dataToSave,
          updatedAt: serverTimestamp(),
          createdAt: initialData.createdAt ? Timestamp.fromDate(new Date(initialData.createdAt)) : serverTimestamp(),
        }, { merge: true }); 
        toast({
          title: "Review Room Updated",
          description: `"${values.title}" has been successfully updated.`,
        });
      } else {
        dataToSave.status = dataToSave.status || 'pending';
        await addDoc(collection(db, "electionRooms"), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        toast({
          title: "Review Room Created",
          description: `"${values.title}" has been successfully created.`,
        });
      }
      router.push("/admin/dashboard");
      router.refresh(); 
    } catch (error) {
      console.error("Error saving review room: ", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save review room. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  if (!isFormMounted && !initialData) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading form...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="branchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Branch</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a branch to house this room" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                This room will be organized under the selected branch on the dashboard.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Room Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Q1 2024 Member Review" {...field} suppressHydrationWarning={true} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Provide a brief description of the review/rating." {...field} rows={4} suppressHydrationWarning={true} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {initialData && ( 
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    {field.value === 'active' ? 'Room is Active' : 'Room is Inactive'}
                  </FormLabel>
                  <FormDescription>
                    Turn this on to allow reviews. Turning it off will close the room.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value === 'active'}
                    onCheckedChange={(checked) => {
                      const currentStatus = form.getValues('status');
                       let newStatus: 'pending' | 'active' | 'closed';
                      if(currentStatus === 'pending' && !checked) {
                        newStatus = 'pending';
                      } else {
                        newStatus = checked ? 'active' : 'closed';
                      }
                      field.onChange(newStatus);
                    }}
                    aria-label="Room Status Toggle"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Positions</h3>
          {positionFields.map((positionItem, positionIndex) => (
            <PositionCard
              key={positionItem.id}
              positionIndex={positionIndex}
              removePosition={removePosition}
              form={form}
              isOnlyPosition={positionFields.length <= 1}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => appendPosition({ 
                id: generateClientSideId('pos'), 
                title: "", 
                candidates: [{ 
                    id: generateClientSideId('cand'), 
                    name: "", 
                }] 
            })}
            className="w-full"
            suppressHydrationWarning={true}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Position
          </Button>
           {form.formState.errors.positions && !form.formState.errors.positions.root && (
             <p className="text-sm font-medium text-destructive">{form.formState.errors.positions.message}</p>
           )}
           {form.formState.errors.positions?.root && (
             <p className="text-sm font-medium text-destructive">{form.formState.errors.positions.root.message}</p>
           )}
        </div>

        <Button type="submit" className="w-full flex-grow" disabled={isLoading} suppressHydrationWarning={true}>
            {isLoading ? (
                <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {initialData ? 'Updating Room...' : 'Creating Room...'}
                </>
            ) : (
                initialData ? 'Update Review Room' : 'Create Review Room'
            )}
        </Button>
      </form>
    </Form>
  );
}

interface PositionCardProps {
  positionIndex: number;
  removePosition: (index: number) => void;
  form: any; 
  isOnlyPosition: boolean;
}

function PositionCard({ positionIndex, removePosition, form, isOnlyPosition }: PositionCardProps) {
  const { control } = form;
  const allElectionRoles = [...facultyRoles, ...clubAuthorities, ...clubOperationTeam, ...generalClubRoles];

  return (
    <Card className="relative group/position">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-md">Position #{positionIndex + 1}</CardTitle>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 cursor-grab active:cursor-grabbing opacity-50 group-hover/position:opacity-100 transition-opacity" suppressHydrationWarning={true}>
            <GripVertical className="h-4 w-4" />
          </Button>
          {!isOnlyPosition && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removePosition(positionIndex)}
              className="text-destructive hover:bg-destructive/10 h-7 w-7"
              suppressHydrationWarning={true}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <FormField
          control={control}
          name={`positions.${positionIndex}.title`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position Title</FormLabel>
               <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a position title" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allElectionRoles.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <SimpleCandidateFields positionIndex={positionIndex} control={form.control} form={form} />
      </CardContent>
    </Card>
  );
}

interface SimpleCandidateFieldsProps {
  positionIndex: number;
  control: any; 
  form: any; 
}

function SimpleCandidateFields({ positionIndex, control, form }: SimpleCandidateFieldsProps) {
  const { fields } = useFieldArray({
    control,
    name: `positions.${positionIndex}.candidates`,
  });

  const { formState: { errors } } = form; 
  const candidateErrors = errors.positions?.[positionIndex]?.candidates;

  return (
    <div className="space-y-6 pl-4 border-l-2 border-primary/20">
      <h4 className="text-sm font-medium text-muted-foreground">Person to be Reviewed:</h4>
      {fields.slice(0, 1).map((candidateItem, candidateIndex) => { 
        return (
          <div key={candidateItem.id} className="flex flex-row items-center gap-4">
            <div className="flex-grow">
                <FormField
                control={control}
                name={`positions.${positionIndex}.candidates.${candidateIndex}.name`}
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-xs sr-only">Candidate Name</FormLabel>
                    <FormControl>
                        <Input placeholder={`Candidate Name`} {...field} suppressHydrationWarning={true} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
          </div>
        );
      })}
      
      {typeof candidateErrors === 'string' && <p className="text-sm font-medium text-destructive">{candidateErrors}</p>}
      {candidateErrors?.root && typeof candidateErrors.root === 'object' && 'message' in candidateErrors.root && (
        <p className="text-sm font-medium text-destructive">{String(candidateErrors.root.message)}</p>
      )}
    </div>
  );
}

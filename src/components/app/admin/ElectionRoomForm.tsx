
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import type { ElectionRoom } from "@/lib/types"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2, Loader2, GripVertical, Image as ImageIcon } from "lucide-react";
import { useState, ChangeEvent, useEffect } from "react";
import Image from "next/image";
import { storage, db } from "@/lib/firebaseClient"; 
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { facultyRoles, clubAuthorities, clubOperationTeam, generalClubRoles } from "@/lib/roles";


const candidateSchema = z.object({
  id: z.string().optional(), 
  name: z.string().min(1, "Candidate name is required."),
  imageUrl: z.string().url("Image URL must be a valid URL.").optional().or(z.literal('')),
  voteCount: z.number().optional(), 
});

const positionSchema = z.object({
  id: z.string().optional(), 
  title: z.string().min(1, "Position title is required."),
  customTitle: z.string().optional(),
  candidates: z.array(candidateSchema).min(1, "At least one candidate is required for a position."),
});

const electionRoomFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  positions: z.array(positionSchema).min(1, "At least one position is required."),
  status: z.enum(["pending", "active", "closed"]).optional(),
}).refine(data => {
    const titles = data.positions.map(p => (p.title === 'Other' ? p.customTitle || '' : p.title).toLowerCase().trim());
    const uniqueTitles = new Set(titles.filter(t => t)); // Filter out empty custom titles
    return uniqueTitles.size === titles.filter(t => t).length;
}, {
    message: "Each position must be unique.",
    path: ["positions"],
}).refine(data => {
    return data.positions.every(p => {
        if (p.title === 'Other') {
            return p.customTitle && p.customTitle.trim().length > 0;
        }
        return true;
    });
}, {
    message: "Custom position title is required when 'Other' is selected.",
    path: ['positions']
});


type ElectionRoomFormValues = z.infer<typeof electionRoomFormSchema>;

interface ElectionRoomFormProps {
  initialData?: ElectionRoom;
}

const generateClientSideId = (prefix: string = "item") => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;


export default function ElectionRoomForm({ initialData }: ElectionRoomFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFormMounted, setIsFormMounted] = useState(false);
  const allElectionRoles = [...facultyRoles, ...clubAuthorities, ...clubOperationTeam, ...generalClubRoles];

  const form = useForm<ElectionRoomFormValues>({
    resolver: zodResolver(electionRoomFormSchema),
    defaultValues: initialData ? {
      title: initialData.title || "",
      description: initialData.description || "",
      status: initialData.status || "pending",
      positions: (initialData.positions || []).map(p => {
        const isCustom = !allElectionRoles.includes(p.title);
        return {
            id: p.id,
            title: isCustom ? 'Other' : p.title || "",
            customTitle: isCustom ? p.title : "",
            candidates: (p.candidates || []).map(c => ({
              id: c.id,
              name: c.name || "",
              imageUrl: c.imageUrl || "",
              voteCount: c.voteCount || 0,
            })),
        }
      }),
    } : {
      title: "",
      description: "",
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
        customTitle: "",
        candidates: [{
          id: generateClientSideId('cand'),
          name: "",
          imageUrl: ""
        }]
      });
    }
  }, [initialData, appendPosition, positionFields.length, form.formState.isMounted]);
  
  async function onSubmit(values: ElectionRoomFormValues) {
    setIsLoading(true);

    const firestoreReadyPositions = values.positions.map(p => ({
        id: p.id || generateClientSideId('pos'),
        title: p.title === 'Other' ? p.customTitle!.trim() : p.title,
        candidates: p.candidates.map(c => ({
            id: c.id || generateClientSideId('cand'),
            name: c.name,
            imageUrl: c.imageUrl,
        })),
    }));

    const dataToSave: any = { 
      title: values.title,
      description: values.description,
      isAccessRestricted: false, // Explicitly set to false
      accessCode: null, // Explicitly set to null
      positions: firestoreReadyPositions,
      roomType: initialData?.roomType || 'voting',
      status: values.status || 'pending',
      groupId: initialData?.groupId || null,
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
          title: "Voting Room Updated",
          description: `"${values.title}" has been successfully updated.`,
        });
      } else {
        dataToSave.status = dataToSave.status || 'pending';
        await addDoc(collection(db, "electionRooms"), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        toast({
          title: "Voting Room Created",
          description: `"${values.title}" has been successfully created.`,
        });
      }
      router.push(`/admin/dashboard`);
      router.refresh(); 
    } catch (error) {
      console.error("Error saving voting room: ", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save voting room. Please try again.",
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
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Annual Student Body Election" {...field} suppressHydrationWarning={true} />
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
                <Textarea placeholder="Provide a brief description of the event." {...field} rows={4} suppressHydrationWarning={true} />
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
                    Turn this on to allow voting. Turning it off will close the room.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value === 'active'}
                    onCheckedChange={(checked) => {
                      // Keep 'pending' if it was pending, otherwise toggle between active/closed
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
          <h3 className="text-lg font-medium">Positions and Candidates</h3>
          {positionFields.map((positionItem, positionIndex) => (
            <PositionCard
              key={positionItem.id}
              positionIndex={positionIndex}
              removePosition={removePosition}
              form={form}
              initialData={initialData}
              isOnlyPosition={positionFields.length <= 1}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => appendPosition({ 
                id: generateClientSideId('pos'), 
                title: "",
                customTitle: "",
                candidates: [{ 
                    id: generateClientSideId('cand'), 
                    name: "", 
                    imageUrl:"" 
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
                initialData ? 'Update Room' : 'Create Room'
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
  initialData?: ElectionRoom;
  isOnlyPosition: boolean;
}

function PositionCard({ positionIndex, removePosition, form, initialData, isOnlyPosition }: PositionCardProps) {
  const { control, watch } = form;
  const allElectionRoles = [...facultyRoles, ...clubAuthorities, ...clubOperationTeam, ...generalClubRoles];
  const positionTitleValue = watch(`positions.${positionIndex}.title`);

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
        <div className="space-y-4">
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
            {positionTitleValue === 'Other' && (
                <FormField
                  control={control}
                  name={`positions.${positionIndex}.customTitle`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Position Title</FormLabel>
                       <FormControl>
                          <Input placeholder="Enter custom title" {...field} />
                       </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
        </div>
        <CandidateFields 
          positionIndex={positionIndex} 
          control={form.control}
          form={form} 
          roomType={initialData?.roomType}
        />
      </CardContent>
    </Card>
  );
}


interface CandidateFieldsProps {
  positionIndex: number;
  control: any; 
  form: any; 
  roomType?: ElectionRoom['roomType'];
}

function CandidateFields({ positionIndex, control, form, roomType }: CandidateFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `positions.${positionIndex}.candidates`,
  });

  const { toast } = useToast();
  const [uploadingStates, setUploadingStates] = useState<Record<string, boolean>>({});
  const [isClientMounted, setIsClientMounted] = useState(false); 

  useEffect(() => {
    setIsClientMounted(true); 
  }, []);

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    rhfCandidateId: string,
    candidateIndex: number
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingStates(prev => ({ ...prev, [rhfCandidateId]: true }));

    try {
      const imageRef = storageRef(storage, `candidate-images/${Date.now()}-${file.name}`);
      await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(imageRef);

      form.setValue(`positions.${positionIndex}.candidates.${candidateIndex}.imageUrl`, downloadURL);
      toast({ title: "Image Uploaded", description: "Candidate image successfully uploaded." });
    } catch (error) {
      console.error("Image upload error:", error);
      toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload candidate image." });
    } finally {
      setUploadingStates(prev => ({ ...prev, [rhfCandidateId]: false }));
      if (event.target) {
        event.target.value = "";
      }
    }
  };
  
  const { formState: { errors } } = form; 
  const candidateErrors = errors.positions?.[positionIndex]?.candidates;
  
  const candidatesToRender = roomType === 'review' ? fields.slice(0, 1) : fields;

  return (
    <div className="space-y-6 pl-4 border-l-2 border-primary/20">
      <h4 className="text-sm font-medium text-muted-foreground">
        {roomType === 'review' ? "Person to be Reviewed:" : "Candidates for this position:"}
      </h4>
      {candidatesToRender.map((candidateItem, candidateIndex) => {
        const currentImageUrl = form.watch(`positions.${positionIndex}.candidates.${candidateIndex}.imageUrl`);
        const uniqueFileIdForInput = isClientMounted ? `file-upload-${candidateItem.id}` : undefined;

        return (
          <div key={candidateItem.id} className="flex flex-col sm:flex-row items-start gap-4 group/candidate p-3 border rounded-md bg-background/50">
            {roomType !== 'review' && (
              <div className="flex-shrink-0 w-full sm:w-auto">
                <FormLabel className="text-xs">Candidate Image</FormLabel>
                <div className="mt-1 w-28 h-28 relative border rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  {uploadingStates[candidateItem.id] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                  {currentImageUrl ? (
                    <Image
                      src={currentImageUrl}
                      alt={`Candidate ${candidateIndex + 1} image`}
                      width={112}
                      height={112}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center" data-ai-hint="person portrait">
                      <ImageIcon className="h-10 w-10" />
                      <span className="text-xs mt-1">No Image</span>
                    </div>
                  )}
                </div>
                <Controller
                  control={control}
                  name={`positions.${positionIndex}.candidates.${candidateIndex}.imageUrl`}
                  render={({ field }) => ( 
                    <Input
                      id={uniqueFileIdForInput}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, candidateItem.id, candidateIndex)}
                      className="mt-2 text-xs h-8"
                      disabled={uploadingStates[candidateItem.id]}
                      suppressHydrationWarning={true}
                    />
                  )}
                />
                <FormMessage>{form.formState.errors.positions?.[positionIndex]?.candidates?.[candidateIndex]?.imageUrl?.message}</FormMessage>
              </div>
            )}

            <div className="flex-grow space-y-3">
                <FormField
                control={control}
                name={`positions.${positionIndex}.candidates.${candidateIndex}.name`}
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-xs">
                      {roomType === 'review' ? "Name" : "Candidate Name"}
                    </FormLabel>
                    <FormControl>
                        <Input placeholder={roomType === 'review' ? "Enter name" : `Candidate ${candidateIndex + 1} Name`} {...field} suppressHydrationWarning={true} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            {fields.length > 1 && roomType !== 'review' && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(candidateIndex)}
                className="text-destructive hover:bg-destructive/10 h-8 w-8 opacity-50 group-hover/candidate:opacity-100 transition-opacity self-start sm:self-center mt-2 sm:mt-0"
                disabled={uploadingStates[candidateItem.id]}
                suppressHydrationWarning={true}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
      
      {roomType !== 'review' && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => append({ id: generateClientSideId('cand'), name: "", imageUrl: "" })}
          className="text-primary hover:text-primary/80 px-0"
          suppressHydrationWarning={true}
        >
          <PlusCircle className="mr-1 h-4 w-4" /> Add Candidate
        </Button>
      )}

      {typeof candidateErrors === 'string' && <p className="text-sm font-medium text-destructive">{candidateErrors}</p>}
      {candidateErrors?.root && typeof candidateErrors.root === 'object' && 'message' in candidateErrors.root && (
        <p className="text-sm font-medium text-destructive">{String(candidateErrors.root.message)}</p>
      )}

    </div>
  );
}

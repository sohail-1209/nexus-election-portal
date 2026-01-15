
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Loader2, Eye, EyeOff, Save, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLatestTerm, updateTermRoles } from "@/lib/electionRoomService";
import { auth } from "@/lib/firebaseClient";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { clubAuthorities, clubOperationTeam } from "@/lib/roles";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { LeadershipRole, Term } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const leadershipRoleSchema = z.object({
    id: z.string(),
    positionTitle: z.string(),
    holderName: z.string(),
    roleType: z.enum(['Authority', 'Lead']),
});

const termEditSchema = z.object({
  roles: z.array(leadershipRoleSchema),
});

type TermEditFormValues = z.infer<typeof termEditSchema>;


interface EditTermDialogProps {
    onTermUpdated: () => void;
    children: React.ReactNode;
}

function EditTermFormSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ))}
        </div>
    )
}

export default function EditTermDialog({ onTermUpdated, children }: EditTermDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<TermEditFormValues>({
    resolver: zodResolver(termEditSchema),
    defaultValues: {
      roles: [],
    },
  });

  const { fields } = useFieldArray({
      control: form.control,
      name: "roles"
  });

  const loadTermData = async () => {
    setIsFormLoading(true);
    const term = await getLatestTerm();
    const existingRoles = new Map(term?.roles.map(r => [r.positionTitle, r.holderName]));

    const allRoles: LeadershipRole[] = [
        ...clubAuthorities.map(title => ({
            id: title.replace(/\s+/g, '-'),
            positionTitle: title,
            holderName: existingRoles.get(title) || '',
            roleType: 'Authority' as const
        })),
        ...clubOperationTeam.map(title => ({
            id: title.replace(/\s+/g, '-'),
            positionTitle: title,
            holderName: existingRoles.get(title) || '',
            roleType: 'Lead' as const
        })),
    ];
    
    form.reset({ roles: allRoles });
    setIsFormLoading(false);
  }

  const handlePasswordConfirm = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      toast({ variant: "destructive", title: "Authentication Error" });
      return;
    }
    setIsLoading(true);
    const credential = EmailAuthProvider.credential(user.email, password);
    try {
      await reauthenticateWithCredential(user, credential);
      setIsAuthenticated(true);
      await loadTermData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Password Incorrect",
        description: "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (values: TermEditFormValues) => {
      setIsLoading(true);
      const result = await updateTermRoles(values.roles);
      if(result.success) {
          toast({ title: "Success", description: result.message });
          onTermUpdated();
          setOpen(false);
      } else {
          toast({ variant: "destructive", title: "Error", description: result.message });
      }
      setIsLoading(false);
  }
  
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setPassword("");
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Leadership Structure</DialogTitle>
          <DialogDescription>
            {isAuthenticated ? "Update the names for each leadership position." : "Enter your password to modify the current leadership term."}
          </DialogDescription>
        </DialogHeader>
        {!isAuthenticated ? (
            <div className="space-y-4 py-2">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Password Required</AlertTitle>
                    <AlertDescription>
                        This is a sensitive action. Confirm your identity to proceed.
                    </AlertDescription>
                </Alert>
                <div className="space-y-2">
                    <Label htmlFor="admin-password-edit-term">Enter your password</Label>
                    <div className="relative">
                    <Input
                        id="admin-password-edit-term"
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
                        onClick={() => setShowPassword((prev) => !prev)}
                    >
                        {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                    <Button onClick={handlePasswordConfirm} disabled={isLoading || password.length < 6}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
                        Authenticate & Edit
                    </Button>
                </DialogFooter>
            </div>
        ) : (
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <ScrollArea className="h-96 pr-4 -mr-4">
                        {isFormLoading ? <EditTermFormSkeleton /> : (
                            <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`roles.${index}.holderName`}
                                        render={({ field: formField }) => (
                                            <FormItem>
                                                <FormLabel>{field.positionTitle}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter holder's name" {...formField} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter className="pt-4">
                         <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isLoading || isFormLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

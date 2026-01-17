
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
import { ShieldAlert, Loader2, Eye, EyeOff, Save, Edit, PlusCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLatestTerm, updateTermRoles, getClubRoles, updateClubRoles } from "@/lib/electionRoomService";
import { auth } from "@/lib/firebaseClient";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { LeadershipRole } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const roleManagementSchema = z.object({
  roles: z.array(z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required."),
    type: z.enum(['Authority', 'Lead', 'Other']),
  })),
  newRoleTitle: z.string().optional(),
  newRoleType: z.enum(['Authority', 'Lead', 'Other']).optional(),
});

type RoleManagementFormValues = z.infer<typeof roleManagementSchema>;

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

  const form = useForm<RoleManagementFormValues>({
    resolver: zodResolver(roleManagementSchema),
    defaultValues: {
      roles: [],
      newRoleTitle: "",
      newRoleType: "Lead",
    },
  });

  const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "roles"
  });

  const loadRoleData = async () => {
    setIsFormLoading(true);
    const clubRoles = await getClubRoles();
    form.reset({ 
        roles: clubRoles.map(r => ({ id: r.id || r.title, title: r.title, type: r.type })),
        newRoleTitle: "",
        newRoleType: "Lead"
    });
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
      await loadRoleData();
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
  
  const handleAddNewRole = () => {
    const newTitle = form.getValues("newRoleTitle");
    const newType = form.getValues("newRoleType");
    if (newTitle && newType) {
        if (fields.some(field => field.title.toLowerCase() === newTitle.toLowerCase())) {
            toast({ variant: "destructive", title: "Duplicate Role", description: "This role title already exists."});
            return;
        }
        append({ id: newTitle, title: newTitle, type: newType });
        form.setValue("newRoleTitle", "");
        form.setValue("newRoleType", "Lead");
    }
  }

  const onSubmit = async (values: RoleManagementFormValues) => {
      setIsLoading(true);
      
      const newRolesForDb = values.roles.map(r => ({ title: r.title, type: r.type }));
      
      const result = await updateClubRoles(newRolesForDb);

      if(result.success) {
          toast({ title: "Success", description: "Club roles have been updated." });
          onTermUpdated(); // This will trigger a refresh on the dashboard
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
      setIsFormLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Club Roles</DialogTitle>
          <DialogDescription>
            {isAuthenticated ? "Add, remove, or edit the official roles for the club." : "Enter your password to manage club roles."}
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
                                <div>
                                    <h4 className="font-medium mb-2">Existing Roles</h4>
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex items-center gap-2 p-2 border rounded-md mb-2">
                                            <div className="flex-grow">
                                                <p className="font-semibold">{field.title}</p>
                                                <p className="text-xs text-muted-foreground">{field.type}</p>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-2 p-3 border-t">
                                     <h4 className="font-medium">Add New Role</h4>
                                     <div className="flex gap-2">
                                         <FormField
                                            control={form.control}
                                            name="newRoleTitle"
                                            render={({ field }) => (
                                                <FormItem className="flex-grow">
                                                    <FormControl>
                                                        <Input placeholder="New position title" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="newRoleType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue/>
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Authority">Authority</SelectItem>
                                                            <SelectItem value="Lead">Lead</SelectItem>
                                                            <SelectItem value="Other">Other</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                     </div>
                                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleAddNewRole}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Role
                                      </Button>
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter className="pt-4">
                         <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isLoading || isFormLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save All Changes
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

    
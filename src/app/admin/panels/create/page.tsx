
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

const panelFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

type PanelFormValues = z.infer<typeof panelFormSchema>;

export default function CreateElectionPanelPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<PanelFormValues>({
        resolver: zodResolver(panelFormSchema),
        defaultValues: {
            title: "",
            description: "",
        },
    });

    async function onSubmit(values: PanelFormValues) {
        setIsLoading(true);
        try {
            await addDoc(collection(db, "electionPanels"), {
                ...values,
                createdAt: serverTimestamp(),
            });
            toast({
                title: "Election Panel Created",
                description: `"${values.title}" has been successfully created.`,
            });
            router.push("/admin/dashboard");
            router.refresh();
        } catch (error) {
            console.error("Error creating panel:", error);
            toast({
                variant: "destructive",
                title: "Creation Failed",
                description: "Could not create the election panel. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="outline" asChild className="mb-4">
        <Link href="/admin/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Create New Election Panel</CardTitle>
          <CardDescription>This panel will act as a container for your voting and review rooms.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Panel Title</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Annual Club Elections 2024" {...field} />
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
                        <FormLabel>Panel Description</FormLabel>
                        <FormControl>
                            <Textarea placeholder="A brief summary of what this collection of rooms is for." {...field} rows={4} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? "Creating..." : "Create Panel"}
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

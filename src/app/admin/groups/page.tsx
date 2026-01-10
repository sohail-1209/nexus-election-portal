
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { getElectionRoomsAndGroups } from "@/lib/electionRoomService";
import type { ElectionRoom, ElectionGroup } from "@/lib/types";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2, ArrowLeft, Users, Folder, Trash2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";


function GroupSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

export default function ManageGroupsPage() {
  const [groups, setGroups] = useState<ElectionGroup[]>([]);
  const [rooms, setRooms] = useState<ElectionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { rooms, groups } = await getElectionRoomsAndGroups();
      setRooms(rooms);
      setGroups(groups);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      toast({ variant: "destructive", title: "Error", description: "Could not load groups and rooms." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData();
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ variant: "destructive", title: "Invalid Name", description: "Group name cannot be empty." });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "groups"), {
        name: newGroupName,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Group Created", description: `Group "${newGroupName}" has been created.` });
      setNewGroupName("");
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Error creating group: ", error);
      toast({ variant: "destructive", title: "Creation Failed", description: "Could not create the group." });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const groupsWithRoomCounts = useMemo(() => {
    return groups.map(group => {
      const count = rooms.filter(room => room.groupId === group.id).length;
      return { ...group, roomCount: count };
    });
  }, [groups, rooms]);

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Create New Group</CardTitle>
          <CardDescription>Groups help you organize your election and review rooms.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-grow space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="e.g., Spring 2024 Elections"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <Button onClick={handleCreateGroup} disabled={isSubmitting || !newGroupName} className="w-full sm:w-auto self-end">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Create Group
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Existing Groups</h2>
        {loading ? (
          <GroupSkeleton />
        ) : groupsWithRoomCounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupsWithRoomCounts.map(group => (
              <Card key={group.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary" /> {group.name}
                  </CardTitle>
                  <CardDescription>Created on {format(new Date(group.createdAt), "PPP")}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" /> {group.roomCount} {group.roomCount === 1 ? 'room' : 'rooms'} in this group.
                  </p>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/admin/groups/${group.id}`}>View Details</Link>
                  </Button>
                   <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action is not yet implemented. Deleting groups will be available in a future update.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Close</AlertDialogCancel>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground border-dashed border-2 rounded-lg">
            <p>No groups found. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  )
}

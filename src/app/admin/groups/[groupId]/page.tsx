
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from 'next/link';
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import type { ElectionRoom, ElectionGroup } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FolderOpen, Users, Vote, Star, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";


function GroupDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full" /></CardContent>
            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
          </Card>
           <Card>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full" /></CardContent>
            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
          </Card>
      </div>
    </div>
  )
}


export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const router = useRouter();
  const { toast } = useToast();

  const [group, setGroup] = useState<ElectionGroup | null>(null);
  const [roomsInGroup, setRoomsInGroup] = useState<ElectionRoom[]>([]);
  const [roomsNotInGroup, setRoomsNotInGroup] = useState<ElectionRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!groupId) return;
    setLoading(true);

    try {
      const groupRef = doc(db, "groups", groupId);
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) {
        toast({ variant: "destructive", title: "Error", description: "Group not found." });
        router.push('/admin/groups');
        return;
      }
      setGroup({ id: groupSnap.id, ...groupSnap.data() } as ElectionGroup);

      const roomsQuery = query(collection(db, "electionRooms"));
      const roomsSnapshot = await getDocs(roomsQuery);
      const allRooms = roomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ElectionRoom[];

      setRoomsInGroup(allRooms.filter(r => r.groupId === groupId));
      setRoomsNotInGroup(allRooms.filter(r => !r.groupId));

    } catch (error) {
      console.error("Error fetching group details:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load group details." });
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
  }, [groupId, router]);

  const handleAddRoomToGroup = async () => {
    if (!selectedRoom) {
      toast({ variant: "destructive", title: "No room selected", description: "Please select a room to add." });
      return;
    }
    
    try {
      const roomRef = doc(db, "electionRooms", selectedRoom);
      await updateDoc(roomRef, { groupId: groupId });
      toast({ title: "Room Added", description: "The room has been added to the group." });
      setSelectedRoom("");
      fetchData(); // Refresh data
    } catch (error) {
       console.error("Error adding room to group:", error);
       toast({ variant: "destructive", title: "Error", description: "Could not add room to the group." });
    }
  };

  if (loading) {
    return <GroupDetailSkeleton />;
  }

  if (!group) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Button variant="outline" asChild>
        <Link href="/admin/groups">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Groups
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-3">
             <FolderOpen className="h-8 w-8 text-primary" /> {group.name}
          </CardTitle>
          <CardDescription>Created on {format(new Date(group.createdAt), "PPP")}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Existing Room to Group</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a room to add..." />
              </SelectTrigger>
              <SelectContent>
                {roomsNotInGroup.length > 0 ? roomsNotInGroup.map(room => (
                  <SelectItem key={room.id} value={room.id}>{room.title}</SelectItem>
                )) : <p className="p-2 text-sm text-muted-foreground">No available rooms</p>}
              </SelectContent>
            </Select>
            <Button onClick={handleAddRoomToGroup} disabled={!selectedRoom} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Room
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div>
        <h2 className="text-2xl font-bold mb-4">Rooms in this Group</h2>
        {roomsInGroup.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roomsInGroup.map(room => (
              <Card key={room.id}>
                <CardHeader>
                  <CardTitle>{room.title}</CardTitle>
                  <CardDescription>{room.roomType === 'review' ? 
                    <span className="flex items-center gap-1"><Star className="h-4 w-4" /> Review Room</span> : 
                    <span className="flex items-center gap-1"><Vote className="h-4 w-4" /> Voting Room</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm flex items-center text-muted-foreground">
                     <Users className="mr-2 h-4 w-4" /> {room.positions.reduce((acc, p) => acc + p.candidates.length, 0)} candidates/items
                  </p>
                </CardContent>
                 <CardFooter>
                   <Button asChild variant="outline" className="w-full">
                     <Link href={`/admin/rooms/${room.id}/manage`}>Manage Room</Link>
                   </Button>
                 </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground border-dashed border-2 rounded-lg">
            <p>No rooms have been added to this group yet.</p>
          </div>
        )}
      </div>

    </div>
  )
}

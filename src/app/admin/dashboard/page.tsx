
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { getElectionRoomsAndGroups } from "@/lib/electionRoomService";
import type { ElectionRoom, Term, LeadershipRole } from "@/lib/types";
import { collection, getDocs, limit, orderBy, query, onSnapshot } from 'firebase/firestore';
import { clubAuthorities, clubOperationTeam } from "@/lib/roles";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, AlertTriangle, BarChart3, Users, LockKeyhole, Settings, Vote, Star, Home, Crown, Shield, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import DeleteRoomDialog from "@/components/app/admin/DeleteRoomDialog";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import ClearTermDialog from "@/components/app/admin/ClearTermDialog";


function LeadershipSkeleton() {
    return (
        <div className="space-y-8">
            <div className="text-center">
                <Skeleton className="h-10 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto mt-3" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-5 w-2/3" />
                                <Skeleton className="h-6 w-1/2" />
                            </CardHeader>
                        </Card>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                     {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-5 w-2/3" />
                                <Skeleton className="h-6 w-1/2" />
                            </CardHeader>
                        </Card>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

function RoleCard({ title, holder, type }: { title: string, holder?: string, type: 'Authority' | 'Lead' }) {
    const icon = type === 'Authority' ? <Crown className="h-6 w-6 text-amber-500" /> : <Star className="h-6 w-6 text-blue-500" />;
    
    return (
        <Card className="hover:shadow-lg transition-shadow bg-card/50">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardDescription>{title}</CardDescription>
                    {icon}
                </div>
                <CardTitle className="text-2xl pt-2">{holder || 'Position Vacant'}</CardTitle>
            </CardHeader>
        </Card>
    )
}

function LeadershipView({onTermCleared}: {onTermCleared: () => void}) {
  const [term, setTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLatestTerm = useCallback(async () => {
    setLoading(true);
    try {
      const termsCollection = collection(db, 'terms');
      const q = query(termsCollection, orderBy('createdAt', 'desc'), limit(1));
      const unsubscribe = onSnapshot(q, (termSnapshot) => {
        if (!termSnapshot.empty) {
          const termDoc = termSnapshot.docs[0];
          setTerm({ id: termDoc.id, ...termDoc.data() } as Term);
        } else {
          setTerm(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error("Error fetching latest term:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    fetchLatestTerm().then(unsub => { unsubscribe = unsub });
    return () => {
        if(unsubscribe) {
            unsubscribe();
        }
    };
  }, [fetchLatestTerm]);

  const leadershipRoles = useMemo(() => {
      const pinnedRoles = new Map(term?.roles.map(r => [r.positionTitle, r.holderName]));
      
      const authorities = clubAuthorities.map(title => ({
          title,
          holderName: pinnedRoles.get(title),
          roleType: 'Authority' as const
      }));

      const leads = clubOperationTeam.map(title => ({
          title,
          holderName: pinnedRoles.get(title),
          roleType: 'Lead' as const
      }));

      return { authorities, leads };

  }, [term]);


  if (loading) {
    return <LeadershipSkeleton />;
  }

  if (!term) {
    return (
      <div className="text-center p-6">
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <Users className="h-16 w-16 mx-auto text-muted-foreground" />
                <CardTitle className="mt-4">No Leadership Term Published</CardTitle>
                <CardDescription className="mt-2">
                    There is currently no active leadership term published on the dashboard. Please complete an election and use the "Pin Results to Home" feature to publish the new leadership structure.
                </CardDescription>
            </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10 p-6">
        <header className="text-center">
            <div className="flex justify-center mb-4">
                 <ClearTermDialog onTermCleared={onTermCleared} />
            </div>
            <h1 className="text-4xl font-bold font-headline">Current Leadership Structure</h1>
            <p className="text-muted-foreground mt-2 text-lg">
                Official leadership for the term starting {format(new Date(term.startDate), 'PPP')}.
            </p>
             <div className="flex justify-center items-center gap-6 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Term: {format(new Date(term.startDate), 'MMM d, yyyy')} - {format(new Date(term.endDate), 'MMM d, yyyy')}</span>
                </div>
            </div>
        </header>

        
        <section>
            <div className="flex items-center gap-3 mb-4">
                <Shield className="h-7 w-7 text-primary" />
                <h2 className="text-3xl font-semibold">Authorities</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {leadershipRoles.authorities.map(role => <RoleCard key={role.title} title={role.title} holder={role.holderName} type={role.roleType} />)}
            </div>
        </section>

        <section>
             <div className="flex items-center gap-3 mb-4">
                <Star className="h-7 w-7 text-primary" />
                <h2 className="text-3xl font-semibold">Leads</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {leadershipRoles.leads.map(role => <RoleCard key={role.title} title={role.title} holder={role.holderName} type={role.roleType} />)}
            </div>
        </section>
        
    </div>
  );
}


function DashboardSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      <div className="w-64 flex-shrink-0 bg-muted/40 p-4 flex flex-col gap-2 border-r">
          <div className="font-bold text-lg p-4 mb-2"><Skeleton className="h-6 w-3/4" /></div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
      </div>
      <main className="flex-1 p-6 overflow-auto">
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
                  <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                </Card>
                 <Card>
                  <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
                  <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                </Card>
            </div>
          </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: ElectionRoom['status'] }) {
  switch (status) {
    case 'active':
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    case 'closed':
      return <Badge variant="destructive">Closed</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

function RoomTypeBadge({ type }: { type: ElectionRoom['roomType'] }) {
  if (type === 'review') {
    return (
      <Badge variant="outline" className="text-purple-600 border-purple-500/50">
        <Star className="mr-1 h-3 w-3" /> REVIEW
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-primary border-primary/50">
      <Vote className="mr-1 h-3 w-3" /> VOTING
    </Badge>
  );
}

function RoomCard({ room, onRoomDeleted }: { room: ElectionRoom; onRoomDeleted: () => void; }) {
    const { enableDeletion } = useSettingsStore();

    return (
        <Card className="flex flex-col hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
                 <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg font-headline mb-1 line-clamp-2 flex-grow">{room.title}</CardTitle>
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <StatusBadge status={room.status} />
                        <RoomTypeBadge type={room.roomType} />
                    </div>
                </div>
                <CardDescription className="text-sm line-clamp-3 pt-1">{room.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-primary" /> {room.positions.reduce((acc, p) => acc + p.candidates.length, 0)} Candidates
                </div>
                <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-primary" /> Created: {format(new Date(room.createdAt), "PPP")}
                </div>
                {room.isAccessRestricted && (
                    <div className="flex items-center">
                        <LockKeyhole className="mr-2 h-4 w-4 text-primary" /> Access Restricted
                    </div>
                )}
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 items-center">
                 <Button variant="outline" asChild className="w-full">
                    <Link href={`/admin/rooms/${room.id}/manage`}>
                        <Settings className="mr-2 h-4 w-4" /> Manage
                    </Link>
                </Button>
                <Button variant="default" asChild className="w-full">
                    <Link href={`/admin/rooms/${room.id}/results`}>
                        <BarChart3 className="mr-2 h-4 w-4" /> Results
                    </Link>
                </Button>
                <div className="col-span-2">
                   {enableDeletion && <DeleteRoomDialog roomId={room.id} roomTitle={room.title} onRoomDeleted={onRoomDeleted} />}
                </div>
            </CardFooter>
        </Card>
    );
}

function RoomList({ rooms, roomType, onRoomDeleted }: { rooms: ElectionRoom[], roomType: 'voting' | 'review', onRoomDeleted: () => void }) {
    const isVoting = roomType === 'voting';
    
    return (
        <div className="flex flex-col h-full p-6">
            <div className="flex-shrink-0 flex justify-between items-center pb-4">
                <div>
                    <h2 className="text-xl font-bold">{isVoting ? "Voting Rooms" : "Review & Rating Rooms"}</h2>
                    <p className="text-sm text-muted-foreground">{isVoting ? "Create and manage standard elections." : "Gather feedback and ratings."}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={isVoting ? "/admin/rooms/create" : "/admin/rooms/create-review"}>
                      <PlusCircle /> Create New
                  </Link>
                </Button>
            </div>
            <ScrollArea className="flex-grow pr-4 -mr-4">
              <div className="h-full">
                  {rooms.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                        {rooms.map(room => (
                            <RoomCard key={room.id} room={room} onRoomDeleted={onRoomDeleted} />
                        ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-20 border-2 border-dashed rounded-lg h-full flex items-center justify-center">
                        No {isVoting ? 'voting' : 'review'} rooms found.
                    </div>
                  )}
              </div>
            </ScrollArea>
        </div>
    );
}


export default function AdminDashboardPage() {
  const [electionRooms, setElectionRooms] = useState<ElectionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'home' | 'voting' | 'review'>('home');
  const [termCleared, setTermCleared] = useState(0);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { rooms } = await getElectionRoomsAndGroups();
      setElectionRooms(rooms);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        setError("You do not have permission to view the dashboard. Please contact support.");
      } else {
        setError("An unexpected error occurred while loading the dashboard. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData();
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [router, fetchData]);

  const { votingRooms, reviewRooms } = useMemo(() => {
    const votingRooms = electionRooms.filter(room => room.roomType !== 'review' && room.status !== 'archived');
    const reviewRooms = electionRooms.filter(room => room.roomType === 'review' && room.status !== 'archived');
    return { votingRooms, reviewRooms };
  }, [electionRooms]);

  const handleTermCleared = () => {
      setTermCleared(c => c + 1); 
  };


  if (loading) {
    return <DashboardSkeleton />;
  }
  
  if (error) {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Card className="w-full max-w-2xl mx-auto mt-10 shadow-xl border-destructive">
                <CardHeader className="text-center">
                <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-4">
                    <AlertTriangle className="h-10 w-10" />
                </div>
                <CardTitle className="text-2xl">Error Loading Dashboard</CardTitle>
                <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                <Button onClick={() => router.push('/admin/login')}>
                    Go to Login Page
                </Button>
                </CardContent>
            </Card>
        </div>
    )
  }
  
  const navItemClasses = "flex items-center gap-3 justify-start px-4 py-3 text-muted-foreground font-medium rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground";
  const activeNavItemClasses = "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground";

  const renderActiveView = () => {
    switch (activeView) {
        case 'home':
            return <LeadershipView key={termCleared} onTermCleared={handleTermCleared} />;
        case 'voting':
            return <RoomList rooms={votingRooms} roomType="voting" onRoomDeleted={fetchData} />;
        case 'review':
            return <RoomList rooms={reviewRooms} roomType="review" onRoomDeleted={fetchData} />;
        default:
            return <LeadershipView key={termCleared} onTermCleared={handleTermCleared} />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
        <nav className="w-64 flex-shrink-0 bg-muted/40 p-4 flex flex-col gap-2 border-r">
             <div className="font-bold text-lg p-4 mb-2">Admin Panel</div>
            <button
                onClick={() => setActiveView('home')}
                className={cn(navItemClasses, activeView === 'home' && activeNavItemClasses)}
            >
                <Home className="h-5 w-5" />
                <span>Home</span>
            </button>
            <button
                onClick={() => setActiveView('voting')}
                className={cn(navItemClasses, activeView === 'voting' && activeNavItemClasses)}
            >
                <Vote className="h-5 w-5" />
                <span>Voting Rooms</span>
            </button>
            <button
                onClick={() => setActiveView('review')}
                className={cn(navItemClasses, activeView === 'review' && activeNavItemClasses)}
            >
                <Star className="h-5 w-5" />
                <span>Review Rooms</span>
            </button>
        </nav>
        <main className="flex-1 overflow-auto">
            {renderActiveView()}
        </main>
    </div>
  );
}

    

"use client";

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import type { Term, LeadershipRole } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Crown, Shield, Star, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { clubAuthorities, clubOperationTeam } from "@/lib/roles";

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
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardDescription>{title}</CardDescription>
                    {icon}
                </div>
                <CardTitle className="text-2xl">{holder || 'Position Vacant'}</CardTitle>
            </CardHeader>
        </Card>
    )
}

export default function HomePage() {
  const [term, setTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestTerm = async () => {
      try {
        const termsCollection = collection(db, 'terms');
        const q = query(termsCollection, orderBy('createdAt', 'desc'), limit(1));
        const termSnapshot = await getDocs(q);

        if (!termSnapshot.empty) {
          const termDoc = termSnapshot.docs[0];
          setTerm({ id: termDoc.id, ...termDoc.data() } as Term);
        }
      } catch (error) {
        console.error("Error fetching latest term:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestTerm();
  }, []);

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
    return (
        <div className="container mx-auto py-8 px-4">
            <LeadershipSkeleton />
        </div>
    );
  }

  if (!term) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <Users className="h-16 w-16 mx-auto text-muted-foreground" />
                <CardTitle className="mt-4">No Leadership Term Published</CardTitle>
                <CardDescription className="mt-2">
                    There is currently no active leadership term published on the dashboard. Please check back later.
                </CardDescription>
            </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-10">
        <header className="text-center">
            <h1 className="text-4xl font-bold font-headline">Current Leadership Structure</h1>
            <p className="text-muted-foreground mt-2 text-lg">
                Official leadership for the term starting {format(new Date(term.startDate), 'PPP')}.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Term: {format(new Date(term.startDate), 'MMM d, yyyy')} - {format(new Date(term.endDate), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Source Election: {term.sourceRoomTitle}</span>
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

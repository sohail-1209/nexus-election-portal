
import { db, auth } from "@/lib/firebaseClient";
import { doc, getDoc, collection, query, where, getDocs, runTransaction, Timestamp, DocumentData, orderBy, writeBatch, addDoc, deleteDoc, updateDoc, setDoc, serverTimestamp, limit } from "firebase/firestore";
import { reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import type { ElectionRoom, Voter, Review, Position, FinalizedResults, Term, LeadershipRole } from '@/lib/types';


export async function getElectionRoomsAndGroups(): Promise<{ rooms: ElectionRoom[] }> {
  const roomsCol = collection(db, "electionRooms");
  const roomsQuery = query(roomsCol, orderBy("createdAt", "desc"));
  const roomsSnapshot = await getDocs(roomsQuery);
  const rooms = roomsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "Untitled Election",
      description: data.description || "No description provided.",
      isAccessRestricted: data.isAccessRestricted === true,
      accessCode: data.accessCode || undefined,
      positions: data.positions || [],
      createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString(),
      status: data.status || 'pending',
      roomType: data.roomType || 'voting',
      groupId: data.groupId || null,
      pinnedToTerm: data.pinnedToTerm || false,
    } as ElectionRoom;
  });

  return { rooms };
}

export async function getElectionRoomById(roomId: string, options: { withVoteCounts?: boolean } = {}): Promise<ElectionRoom | null> {
  const { withVoteCounts = false } = options;
  const roomRef = doc(db, "electionRooms", roomId);
  const docSnap = await getDoc(roomRef);

  if (!docSnap.exists()) {
    return null;
  }
  
  const data = docSnap.data();
  if (!data) return null;

  if (data.finalized && data.finalizedResults) {
      return {
          id: docSnap.id,
          title: data.title || "Untitled Room",
          description: data.description || "No description.",
          status: (data.status as ElectionRoom['status']) || 'closed',
          roomType: data.roomType || 'voting',
          finalized: true,
          finalizedResults: data.finalizedResults,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          isAccessRestricted: data.isAccessRestricted === true,
          accessCode: data.accessCode || undefined,
          positions: data.finalizedResults.positions,
          pinnedToTerm: data.pinnedToTerm || false,
      };
  }

  let finalPositions: Position[] = (data.positions || []).map((p: any) => ({
    id: p?.id || `pos-${Math.random().toString(36).substr(2, 9)}`,
    title: p?.title || "Untitled Position",
    candidates: (p?.candidates || []).map((c: any) => ({
      id: c?.id || `cand-${Math.random().toString(36).substr(2, 9)}`,
      name: c?.name || "Unnamed Candidate",
      imageUrl: c?.imageUrl || '',
      voteCount: 0,
    })),
    averageRating: 0,
    reviews: [],
    ratingDistribution: p.ratingDistribution || [],
  }));

  if (withVoteCounts) {
    if (data.roomType === 'review') {
      const reviewsSnap = await getDocs(collection(db, "electionRooms", roomId, "reviews"));
      const reviewsByPosition = new Map<string, Review[]>();

      reviewsSnap.forEach(reviewDoc => {
        const reviewData = reviewDoc.data();
        const positionId = reviewData.positionId;
        const reviews = reviewsByPosition.get(positionId) || [];
        reviews.push({
          rating: reviewData.rating,
          feedback: reviewData.feedback,
          reviewerEmail: reviewData.reviewerEmail,
          reviewedAt: (reviewData.reviewedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        });
        reviewsByPosition.set(positionId, reviews);
      });
      
      finalPositions = finalPositions.map(position => {
        const posReviews = reviewsByPosition.get(position.id) || [];
        const totalRating = posReviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = posReviews.length > 0 ? totalRating / posReviews.length : 0;
        
        const ratingDistribution = [
          { name: '1 Star', count: 0 },
          { name: '2 Stars', count: 0 },
          { name: '3 Stars', count: 0 },
          { name: '4 Stars', count: 0 },
          { name: '5 Stars', count: 0 },
        ];
        posReviews.forEach(r => {
            const starIndex = Math.floor(r.rating) - 1;
            if(starIndex >= 0 && starIndex < 5) {
                ratingDistribution[starIndex].count++;
            }
        });

        return {
          ...position,
          averageRating: parseFloat(averageRating.toFixed(2)),
          reviews: posReviews.sort((a,b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime()),
          ratingDistribution: ratingDistribution
        }
      });

    } else { 
      const votesSnap = await getDocs(collection(db, "electionRooms", roomId, "votes"));
      
      finalPositions = finalPositions.map(position => {
        const candidatesWithVotes = position.candidates.map(candidate => {
          const candidateVotes = votesSnap.docs.filter(doc => doc.data().candidateId === candidate.id && doc.data().positionId === position.id);
          return {
            ...candidate,
            voteCount: candidateVotes.length
          };
        });

        return {
          ...position,
          candidates: candidatesWithVotes
        };
      });
    }
  }

  const createdAtRaw = data.createdAt;
  const updatedAtRaw = data.updatedAt;

  const createdAt = createdAtRaw instanceof Timestamp
    ? createdAtRaw.toDate().toISOString()
    : typeof createdAtRaw === 'string'
    ? createdAtRaw
    : new Date().toISOString();

  const updatedAt = updatedAtRaw instanceof Timestamp
    ? updatedAtRaw.toDate().toISOString()
    : typeof updatedAtRaw === 'string'
    ? updatedAtRaw
    : undefined;

  return {
    id: docSnap.id,
    title: data.title || "Untitled Room",
    description: data.description || "No description.",
    isAccessRestricted: data.isAccessRestricted === true,
    accessCode: data.accessCode || undefined,
    positions: finalPositions,
    createdAt: createdAt,
    updatedAt: updatedAt,
    status: (data.status as ElectionRoom['status']) || 'pending',
    roomType: data.roomType || 'voting',
    finalized: data.finalized || false,
    groupId: data.groupId || null,
    pinnedToTerm: data.pinnedToTerm || false,
  };
}

export async function getVotersForRoom(roomId: string): Promise<Voter[]> {
  const votersColRef = collection(db, "electionRooms", roomId, "voters");
  const votersSnap = await getDocs(query(votersColRef, orderBy("lastActivity", "desc")));

  if (votersSnap.empty) {
    return [];
  }

  const voters = votersSnap.docs.map(doc => {
    const data = doc.data();
    const lastActivity = data.lastActivity instanceof Timestamp 
        ? data.lastActivity.toDate().toISOString() 
        : data.lastActivity;
    
    return {
      email: doc.id,
      status: data.status,
      lastActivity: lastActivity,
      votedAt: data.votedAt instanceof Timestamp ? data.votedAt.toDate().toISOString() : data.votedAt,
      ownPositionTitle: data.ownPositionTitle,
    };
  });
  
  return voters;
}

export async function recordParticipantEntry(
    roomId: string,
    voterEmail: string,
    ownPositionTitle: string
): Promise<{ success: boolean; message: string }> {
    const clubAuthorities = ["President", "Vice President", "Technical Manager", "Event Manager", "Workshop Manager", "PR Manager", "General Secretary"];
    const clubOperationTeam = ["Technical Lead", "Event Lead", "Workshop Lead", "PR Lead", "Assistant Secretary"];
    
    const isRestrictedRole = clubAuthorities.includes(ownPositionTitle) || clubOperationTeam.includes(ownPositionTitle);

    if (isRestrictedRole) {
        const votersColRef = collection(db, "electionRooms", roomId, "voters");
        const q = query(votersColRef, where("ownPositionTitle", "==", ownPositionTitle), where("status", "==", "completed"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { success: false, message: `A submission for the role "${ownPositionTitle}" has already been completed.` };
        }
    }
    
    const voterRef = doc(db, "electionRooms", roomId, "voters", voterEmail);
    try {
        await runTransaction(db, async (transaction) => {
            const voterDoc = await transaction.get(voterRef);
            if (voterDoc.exists()) {
                if (voterDoc.data().status === 'completed') {
                    throw new Error("You have already completed your submission for this room.");
                }
                 transaction.update(voterRef, {
                    ownPositionTitle,
                    lastActivity: serverTimestamp()
                });
            } else {
                transaction.set(voterRef, {
                    status: 'in_room',
                    ownPositionTitle,
                    lastActivity: serverTimestamp()
                });
            }
        });
        return { success: true, message: "Entry recorded." };
    } catch (error: any) {
        console.error("Error recording participant entry:", error);
        return { success: false, message: error.message || "Could not record your entry. Please try again." };
    }
}

export async function submitBallot(
  roomId: string,
  voterEmail: string,
  selections: Record<string, any> 
): Promise<{ success: boolean; message: string }> {
  try {
    const voterRef = doc(db, "electionRooms", roomId, "voters", voterEmail);
    
    const voterSnap = await getDoc(voterRef);
    if (voterSnap.exists() && voterSnap.data().status === 'completed') {
      return { success: false, message: "You have already voted in this election." };
    }

    const roomRef = doc(db, "electionRooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists() || roomSnap.data().status !== 'active') {
      return { success: false, message: "This election is not currently active." };
    }
    
    const batch = writeBatch(db);

    for (const positionId in selections) {
      const candidateId = selections[positionId];
      if (candidateId) {
        const voteRef = doc(collection(db, "electionRooms", roomId, "votes"));
        batch.set(voteRef, {
            positionId: positionId,
            candidateId: candidateId,
            voterEmail: voterEmail,
            votedAt: serverTimestamp(),
        });
      }
    }
    
    batch.set(voterRef, {
      status: 'completed',
      lastActivity: serverTimestamp(),
      votedAt: serverTimestamp(),
    }, { merge: true });

    await batch.commit();

    return { success: true, message: "Your ballot has been successfully submitted." };
  } catch (error: any) {
    console.error("Error submitting ballot:", error);
    return { success: false, message: error.message || "An unexpected error occurred while submitting your ballot." };
  }
}

export async function submitReview(
  roomId: string,
  voterEmail: string,
  selections: Record<string, { rating: number; feedback: string }>
): Promise<{ success: boolean; message: string }> {
  try {
    const voterRef = doc(db, "electionRooms", roomId, "voters", voterEmail);
    
    const voterSnap = await getDoc(voterRef);
    if (voterSnap.exists() && voterSnap.data().status === 'completed') {
        return { success: false, message: "You have already submitted a review for this room." };
    }

    const roomRef = doc(db, "electionRooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists() || roomSnap.data().status !== 'active') {
      return { success: false, message: "This review room is not currently active." };
    }

    const roomData = await getElectionRoomById(roomId);
    if(!roomData) {
        return { success: false, message: "Could not find room data."};
    }
    
    const batch = writeBatch(db);

    for (const positionId in selections) {
      const reviewData = selections[positionId];
      if (reviewData.rating === 0) continue;
      
      const position = roomData.positions.find(p => p.id === positionId);
      if (position && position.candidates[0]) {
          const reviewRef = doc(collection(db, "electionRooms", roomId, "reviews"));
          batch.set(reviewRef, {
              positionId,
              candidateId: position.candidates[0].id,
              rating: reviewData.rating,
              feedback: reviewData.feedback,
              reviewerEmail: voterEmail,
              reviewedAt: serverTimestamp(),
          });
      }
    }
    
    batch.set(voterRef, {
      status: 'completed',
      lastActivity: serverTimestamp(),
      votedAt: serverTimestamp(),
    }, { merge: true });

    await batch.commit();
    
    return { success: true, message: "Your review has been successfully submitted." };
  } catch (error: any) {
    console.error("Error submitting review:", error);
    return { success: false, message: error.message || "An unexpected error occurred while submitting your review." };
  }
}

export async function finalizeAndAnonymizeRoom(roomId: string, adminPassword: string): Promise<{ success: boolean, message: string }> {
    const user = auth.currentUser;
    if (!user || !user.email) {
        return { success: false, message: "Authentication required. Please log in again." };
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, adminPassword);
        await reauthenticateWithCredential(user, credential);

        const roomRef = doc(db, "electionRooms", roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            return { success: false, message: "Room not found." };
        }
        if (roomSnap.data().finalized) {
            return { success: false, message: "This room has already been finalized." };
        }

        const roomData = roomSnap.data();
        const results = await getElectionRoomById(roomId, { withVoteCounts: true });
        
        if (!results) {
            return { success: false, message: "Could not retrieve current results." };
        }
        
        let totalParticipants = 0;
        const voters = await getVotersForRoom(roomId);
        const completedVoters = voters.filter(v => v.status === 'completed');

        if (roomData.roomType === 'voting') {
            totalParticipants = completedVoters.length;
        } else {
            const maxReviews = Math.max(...(results.positions.map(p => p.reviews?.length || 0)), 0);
            totalParticipants = maxReviews;
        }

        const finalizedResults: FinalizedResults = {
            positions: results.positions.map(p => ({
                id: p.id,
                title: p.title,
                candidates: p.candidates.map(c => ({
                  id: c.id,
                  name: c.name,
                  imageUrl: c.imageUrl,
                  voteCount: c.voteCount,
                })),
                reviews: p.reviews?.map(r => ({ 
                    rating: r.rating, 
                    feedback: r.feedback, 
                    reviewedAt: r.reviewedAt 
                })) || [],
                averageRating: p.averageRating,
                ratingDistribution: p.ratingDistribution,
            })),
            totalParticipants: totalParticipants,
            finalizedAt: new Date().toISOString(),
        };

        const batch = writeBatch(db);

        batch.update(roomRef, {
            finalized: true,
            finalizedResults: finalizedResults,
            status: 'closed',
        });

        const votesColRef = collection(db, "electionRooms", roomId, "votes");
        const votesSnap = await getDocs(votesColRef);
        votesSnap.forEach(doc => batch.delete(doc.ref));
        
        const reviewsColRef = collection(db, "electionRooms", roomId, "reviews");
        const reviewsSnap = await getDocs(reviewsColRef);
        reviewsSnap.forEach(doc => batch.delete(doc.ref));

        const votersColRef = collection(db, "electionRooms", roomId, "voters");
        voters.forEach(voter => {
            batch.delete(doc(votersColRef, voter.email));
        });

        await batch.commit();

        return { success: true, message: "Results have been finalized and all submission data has been permanently deleted." };

    } catch (error: any) {
        console.error("Finalization error:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            return { success: false, message: "Incorrect password. Finalization failed." };
        }
        if (error.code === 'auth/requires-recent-login') {
            return { success: false, message: "This sensitive action requires a recent login. Please log out and back in." };
        }
        return { success: false, message: "An unexpected error occurred during finalization." };
    }
}

async function deleteSubcollection(batch: any, collectionRef: any) {
    const snapshot = await getDocs(collectionRef);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
}

export async function deleteRoomPermanently(roomId: string, adminPassword: string): Promise<{ success: boolean, message: string }> {
    const user = auth.currentUser;
    if (!user || !user.email) {
        return { success: false, message: "Authentication required. Please log in again." };
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, adminPassword);
        await reauthenticateWithCredential(user, credential);

        const roomRef = doc(db, "electionRooms", roomId);
        const batch = writeBatch(db);

        await deleteSubcollection(batch, collection(db, roomRef.path, 'votes'));
        await deleteSubcollection(batch, collection(db, roomRef.path, 'voters'));
        await deleteSubcollection(batch, collection(db, roomRef.path, 'reviews'));

        batch.delete(roomRef);

        await batch.commit();

        return { success: true, message: "Room and all its data have been permanently deleted." };

    } catch (error: any) {
        console.error("Permanent delete room error:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            return { success: false, message: "Incorrect password. Deletion failed." };
        }
        if (error.code === 'auth/requires-recent-login') {
            return { success: false, message: "This sensitive action requires a recent login. Please log out and back in." };
        }
        return { success: false, message: error.message || "An unexpected error occurred during deletion." };
    }
}

export async function pinResultsToHome(
    termData: Omit<Term, 'id' | 'createdAt'>,
    isNewTerm: boolean
): Promise<{ success: boolean; message: string, termId?: string }> {
    try {
        const roomRef = doc(db, 'electionRooms', termData.sourceRoomId);
        
        if (isNewTerm) {
            // Create a new term, replacing any old one.
            const newTermRef = await addDoc(collection(db, 'terms'), {
                ...termData,
                createdAt: serverTimestamp()
            });
            await updateDoc(roomRef, { pinnedToTerm: true });
            return { success: true, message: 'New leadership term has been published to the dashboard.', termId: newTermRef.id };
        } else {
            // Merge with the most recent existing term.
            const termsCollection = collection(db, 'terms');
            const q = query(termsCollection, orderBy('createdAt', 'desc'), limit(1));
            const termSnapshot = await getDocs(q);

            if (termSnapshot.empty) {
                // If no term exists, create a new one anyway.
                const newTermRef = await addDoc(collection(db, 'terms'), { ...termData, createdAt: serverTimestamp() });
                await updateDoc(roomRef, { pinnedToTerm: true });
                return { success: true, message: 'Leadership term has been published to the dashboard.', termId: newTermRef.id };
            }

            const existingTermDoc = termSnapshot.docs[0];
            const existingTermData = existingTermDoc.data() as Term;

            // Create a map of existing roles for easy lookup.
            const existingRolesMap = new Map(existingTermData.roles.map(role => [role.positionTitle, role]));

            // Merge new roles, overwriting duplicates.
            termData.roles.forEach(newRole => {
                existingRolesMap.set(newRole.positionTitle, newRole);
            });

            const mergedRoles = Array.from(existingRolesMap.values());

            await updateDoc(existingTermDoc.ref, { roles: mergedRoles });
            await updateDoc(roomRef, { pinnedToTerm: true });

            return { success: true, message: 'Leadership roles have been merged into the current term.', termId: existingTermDoc.id };
        }
    } catch (error) {
        console.error("Error pinning results to home:", error);
        return { success: false, message: 'An unexpected error occurred while publishing the term.' };
    }
}


export async function getLatestTerm(): Promise<Term | null> {
    try {
        const termsCollection = collection(db, 'terms');
        const q = query(termsCollection, orderBy('createdAt', 'desc'), limit(1));
        const termSnapshot = await getDocs(q);

        if (termSnapshot.empty) {
            return null;
        }
        
        const termDoc = termSnapshot.docs[0];
        return { id: termDoc.id, ...termDoc.data() } as Term;

    } catch (error) {
        console.error("Error fetching latest term:", error);
        return null;
    }
}

export async function clearLatestTerm(adminPassword: string): Promise<{ success: boolean; message: string }> {
    const user = auth.currentUser;
    if (!user || !user.email) {
        return { success: false, message: "Authentication required. Please log in again." };
    }
    try {
        const credential = EmailAuthProvider.credential(user.email, adminPassword);
        await reauthenticateWithCredential(user, credential);

        const latestTerm = await getLatestTerm();
        if (!latestTerm) {
            return { success: true, message: "There is no active term to clear." };
        }
        
        await deleteDoc(doc(db, 'terms', latestTerm.id));
        
        return { success: true, message: "The latest term has been cleared." };

    } catch (error: any) {
        console.error("Error clearing term:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            return { success: false, message: "Incorrect password. Action failed." };
        }
        return { success: false, message: "An unexpected error occurred while clearing the term." };
    }
}

export async function updateTermRoles(updatedRoles: LeadershipRole[]): Promise<{ success: boolean; message: string }> {
    try {
        const latestTerm = await getLatestTerm();

        if (latestTerm) {
            // If a term exists, update its roles
            const termRef = doc(db, 'terms', latestTerm.id);
            await updateDoc(termRef, { roles: updatedRoles });
            return { success: true, message: 'Leadership structure has been updated.' };
        } else {
            // If no term exists, create a new one
            const newTermData = {
                startDate: new Date().toISOString(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString(),
                roles: updatedRoles,
                createdAt: serverTimestamp(),
                sourceRoomId: 'manual_update',
                sourceRoomTitle: 'Manual Admin Edit',
            };
            await addDoc(collection(db, 'terms'), newTermData);
            return { success: true, message: 'New leadership term has been created and updated.' };
        }
    } catch (error) {
        console.error("Error updating term roles:", error);
        return { success: false, message: 'An unexpected error occurred while updating the leadership structure.' };
    }
}
    

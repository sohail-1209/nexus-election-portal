
import { db, auth } from "@/lib/firebaseClient";
import { doc, getDoc, collection, query, where, getDocs, runTransaction, Timestamp, DocumentData, orderBy, writeBatch, addDoc, deleteDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import type { ElectionRoom, Voter, Review, Position, FinalizedResults, ElectionGroup } from '@/lib/types';


export async function getElectionRoomsAndGroups(): Promise<{ rooms: ElectionRoom[] }> {
  const roomsCol = collection(db, "electionRooms");
  // Updated query to exclude archived rooms from the main dashboard
  const roomsQuery = query(roomsCol, where("status", "!=", "archived"), orderBy("status"), orderBy("createdAt", "desc"));
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
    } as ElectionRoom;
  });

  return { rooms };
}

export async function getArchivedRooms(): Promise<ElectionRoom[]> {
  const roomsCol = collection(db, "electionRooms");
  const roomsQuery = query(roomsCol, where("status", "==", "archived"), orderBy("createdAt", "desc"));
  const roomsSnapshot = await getDocs(roomsQuery);
  return roomsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "Untitled Election",
      description: data.description || "No description provided.",
      createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      status: data.status,
      roomType: data.roomType || 'voting',
      // We don't need full position/candidate data for the archived list
      positions: [],
      isAccessRestricted: false,
    } as ElectionRoom;
  });
}

export async function archiveRoom(roomId: string, adminPassword: string): Promise<{ success: boolean; message: string }> {
    const user = auth.currentUser;
    if (!user || !user.email) {
        return { success: false, message: "Authentication required. Please log in again." };
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, adminPassword);
        await reauthenticateWithCredential(user, credential);
        
        const roomRef = doc(db, "electionRooms", roomId);
        await updateDoc(roomRef, { status: "archived" });

        return { success: true, message: "Room successfully archived." };
    } catch (error: any) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            return { success: false, message: "Incorrect password. Archiving failed." };
        }
        console.error("Archive error:", error);
        return { success: false, message: "An unexpected error occurred." };
    }
}

export async function restoreRoom(roomId: string): Promise<{ success: boolean; message: string }> {
    try {
        const roomRef = doc(db, "electionRooms", roomId);
        await updateDoc(roomRef, { status: "pending" });
        return { success: true, message: "Room successfully restored." };
    } catch (error: any) {
        console.error("Restore error:", error);
        return { success: false, message: "An unexpected error occurred during restoration." };
    }
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

  // If results are finalized, they are stored on the doc. No need to query subcollections.
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
          // These fields are less relevant post-finalization but are kept for type consistency
          isAccessRestricted: data.isAccessRestricted === true,
          accessCode: data.accessCode || undefined,
          positions: data.finalizedResults.positions,
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

    } else { // 'voting' room type
      const votesSnap = await getDocs(collection(db, "electionRooms", roomId, "votes"));
      const voteCounts = new Map<string, number>();
      votesSnap.forEach(voteDoc => {
        const voteData = voteDoc.data();
        const candidateId = voteData.candidateId;
        voteCounts.set(candidateId, (voteCounts.get(candidateId) || 0) + 1);
      });
      
      finalPositions = finalPositions.map(position => ({
        ...position,
        candidates: position.candidates.map(candidate => ({
          ...candidate,
          voteCount: voteCounts.get(candidate.id) || 0,
          positionTitle: position.title, // Add position title to candidate
        })),
      }));
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
    const clubAuthorities = ["President", "Vice-President", "Technical Manager", "Event Manager", "Workshop Manager", "Project Manager", "PR Manager", "Convo Manager", "General Secretary"];
    const clubOperationTeam = ["Technical Lead", "Event Lead", "Workshop Lead", "Project Lead", "PR Lead", "Convo Lead", "Assistant Secretary"];
    
    const isRestrictedRole = clubAuthorities.includes(ownPositionTitle) || clubOperationTeam.includes(ownPositionTitle);

    // For restricted roles, enforce the single-submission-per-position rule.
    if (isRestrictedRole) {
        const votersColRef = collection(db, "electionRooms", roomId, "voters");
        const q = query(votersColRef, where("ownPositionTitle", "==", ownPositionTitle), where("status", "==", "completed"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { success: false, message: `A submission for the role "${ownPositionTitle}" has already been completed.` };
        }
    }
    
    // For all roles, record their entry or update their activity timestamp.
    const voterRef = doc(db, "electionRooms", roomId, "voters", voterEmail);
    try {
        await runTransaction(db, async (transaction) => {
            const voterDoc = await transaction.get(voterRef);
            if (voterDoc.exists()) {
                 // Even for non-restricted roles, if THIS SPECIFIC user has already completed, block them.
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
  selections: Record<string, string | null> // positionId -> candidateId | null
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

    const votesPromises = [];
    for (const positionId in selections) {
      const candidateId = selections[positionId];
      if (candidateId) {
        const voteRef = collection(db, "electionRooms", roomId, "votes");
        votesPromises.push(addDoc(voteRef, {
          positionId,
          candidateId,
          voterEmail,
          votedAt: serverTimestamp(),
        }));
      }
    }
    await Promise.all(votesPromises);
    
    await setDoc(voterRef, {
      status: 'completed',
      lastActivity: serverTimestamp(),
      votedAt: serverTimestamp(),
    }, { merge: true });

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

    const roomData = roomSnap.data();
    const positions = roomData.positions || [];
    
    const reviewPromises = [];
    for (const positionId in selections) {
      const reviewData = selections[positionId];
      const position = positions.find((p: any) => p.id === positionId);
      const candidateId = position?.candidates[0]?.id;

      if (candidateId) {
        // Skip submissions if rating is 0 (which means it was skipped by coordinator)
        if (reviewData.rating === 0) continue;

        const reviewRef = collection(db, "electionRooms", roomId, "reviews");
        reviewPromises.push(addDoc(reviewRef, {
          positionId,
          candidateId,
          rating: reviewData.rating,
          feedback: reviewData.feedback,
          reviewerEmail: voterEmail,
          reviewedAt: serverTimestamp(),
        }));
      }
    }
    await Promise.all(reviewPromises);
    
    await setDoc(voterRef, {
      status: 'completed',
      lastActivity: serverTimestamp(),
      votedAt: serverTimestamp(),
    }, { merge: true });
    
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
        } else { // review room
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

        // Update the main room document with finalized results
        batch.update(roomRef, {
            finalized: true,
            finalizedResults: finalizedResults,
            status: 'closed', // Also ensure status is closed
        });

        // Delete all documents in the 'votes' subcollection
        const votesColRef = collection(db, "electionRooms", roomId, "votes");
        const votesSnap = await getDocs(votesColRef);
        votesSnap.forEach(doc => batch.delete(doc.ref));
        
        // Delete all documents in the 'reviews' subcollection
        const reviewsColRef = collection(db, "electionRooms", roomId, "reviews");
        const reviewsSnap = await getDocs(reviewsColRef);
        reviewsSnap.forEach(doc => batch.delete(doc.ref));

        // Delete the 'voters' subcollection documents for complete anonymity
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

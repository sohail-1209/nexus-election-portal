
export interface Candidate {
  name: string;
  imageUrl?: string;
  voteCount?: number; // Optional: for results
  positionTitle?: string; // Optional: for consolidated reports
  id?: string; // This is now optional and will be removed from most logic
}

export interface Review {
  rating: number;
  feedback: string;
  reviewerEmail?: string; // This will only exist on live data, not finalized data
  reviewedAt: string;
}

export interface Position {
  id: string;
  title: string;
  candidates: Candidate[];
  // For review results
  averageRating?: number;
  reviews?: Review[];
  ratingDistribution?: { name: string, count: number }[];
}

export interface FinalizedResults {
  positions: Position[];
  totalParticipants: number;
  finalizedAt: string;
}

export interface ElectionRoom {
  id:string;
  title: string;
  description: string;
  isAccessRestricted: boolean; // Example property
  accessCode?: string; // For joining the room
  positions: Position[];
  createdAt: string;
  updatedAt?: string; // Added for Firestore timestamp
  status: 'pending' | 'active' | 'closed' | 'archived';
  roomType?: 'voting' | 'review';
  finalized?: boolean; // New flag to indicate if results are baked in
  finalizedResults?: FinalizedResults; // Stored static results
  groupId?: string | null;
}

export interface Voter {
  email: string;
  status: 'in_room' | 'completed';
  lastActivity?: string;
  votedAt?: string;
  ownPositionTitle?: string;
}

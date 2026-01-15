
export interface Candidate {
  name: string;
  imageUrl?: string;
  voteCount?: number; // Optional: for results
  positionTitle?: string; // Optional: for consolidated reports
  id?: string;
}

export interface Review {
  rating: number;
  feedback: string;
  reviewerEmail?: string; 
  reviewedAt: string;
}

export interface Position {
  id: string;
  title: string;
  candidates: Candidate[];
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
  isAccessRestricted: boolean;
  accessCode?: string;
  positions: Position[];
  createdAt: string;
  updatedAt?: string;
  status: 'pending' | 'active' | 'closed' | 'archived';
  roomType?: 'voting' | 'review';
  finalized?: boolean;
  finalizedResults?: FinalizedResults;
  groupId?: string | null;
  pinnedToTerm?: boolean;
}

export interface Voter {
  email: string;
  status: 'in_room' | 'completed';
  lastActivity?: string;
  votedAt?: string;
  ownPositionTitle?: string;
}

// New Types for Leadership Dashboard
export interface LeadershipRole {
    id: string;
    positionTitle: string;
    holderName: string;
    roleType: 'Authority' | 'Lead';
}

export interface Term {
    id: string;
    startDate: string;
    endDate: string;
    roles: LeadershipRole[];
    createdAt: string;
    sourceRoomId: string;
    sourceRoomTitle: string;
}

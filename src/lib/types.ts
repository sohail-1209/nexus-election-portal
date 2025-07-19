
export interface Candidate {
  id: string;
  name: string;
  imageUrl?: string;
  voteCount?: number; // Optional: for results
}

export interface Review {
  rating: number;
  feedback: string;
  reviewerEmail: string;
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

export interface Branch {
  id: string;
  name: string;
  description: string;
  createdAt: string;
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
  status: 'pending' | 'active' | 'closed';
  roomType?: 'voting' | 'review';
  branchId?: string;
}

export interface Voter {
  email: string;
  status: 'in_room' | 'completed';
  lastActivity?: string;
  votedAt?: string;
  ownPositionTitle?: string;
}

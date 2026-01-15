
// This file is now deprecated for providing the master list of roles.
// Roles are now managed dynamically in the 'clubRoles' collection in Firestore.
// These arrays are kept for now to support legacy functionality and can be
// used as a fallback or for initial seeding.

export const facultyRoles = ["Coordinator"];

export const clubAuthorities = [
    "President", 
    "Vice President", 
    "Technical Manager", 
    "Event Manager", 
    "Workshop Manager", 
    "PR Manager", 
    "General Secretary"
];

export const clubOperationTeam = [
    "Technical Lead", 
    "Event Lead", 
    "Workshop Lead", 
    "PR Lead", 
    "Assistant Secretary"
];

export const generalClubRoles = [
    "Public Relation Team",
    "Design and Content Creation Team", 
    "Documentation and Archive Team", 
    "Logistics Team", 
    "Technical Team", 
    "Networking and Collaboration Team", 
    "Member",
    "Other"
];

// All roles that can be selected in a voting room
export const allElectionRoles = [
    ...facultyRoles,
    ...clubAuthorities,
    ...clubOperationTeam,
    ...generalClubRoles.filter(r => r !== 'Other'), // Add general roles, exclude duplicate 'Other'
    "Other" // Keep other for custom roles
];

    
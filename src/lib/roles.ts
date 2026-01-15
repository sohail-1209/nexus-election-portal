
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

// All roles that can be selected in a voting room
export const allElectionRoles = [
    ...facultyRoles,
    ...clubAuthorities,
    ...clubOperationTeam,
    "Other" // Keep other for custom roles
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

    
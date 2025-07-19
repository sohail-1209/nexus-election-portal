
'use server';

import { db } from "@/lib/firebaseClient";
import { doc, collection, query, getDocs, addDoc, serverTimestamp, orderBy, Timestamp } from "firebase/firestore";
import type { Branch } from '@/lib/types';

export async function createBranch(name: string, description: string): Promise<{ success: boolean; message: string; branchId?: string }> {
  if (!name.trim()) {
    return { success: false, message: "Branch name cannot be empty." };
  }
  try {
    const docRef = await addDoc(collection(db, "branches"), {
      name,
      description,
      createdAt: serverTimestamp(),
    });
    return { success: true, message: "Branch created successfully.", branchId: docRef.id };
  } catch (error) {
    console.error("Error creating branch:", error);
    return { success: false, message: "An unexpected error occurred while creating the branch." };
  }
}

export async function getBranches(): Promise<Branch[]> {
  const branchesCol = collection(db, "branches");
  const q = query(branchesCol, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    const createdAtRaw = data.createdAt;
    const createdAt = createdAtRaw instanceof Timestamp
      ? createdAtRaw.toDate().toISOString()
      : new Date().toISOString();

    return {
      id: doc.id,
      name: data.name || "Untitled Branch",
      description: data.description || "",
      createdAt: createdAt,
    };
  });
}

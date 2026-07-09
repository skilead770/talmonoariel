import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { BarMitzvahRecord } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyAIGiADB278H33-66rWd08HtAWmh-0vrEs",
  authDomain: "studio-5533055197-5fe00.firebaseapp.com",
  projectId: "studio-5533055197-5fe00",
  storageBucket: "studio-5533055197-5fe00.firebasestorage.app",
  messagingSenderId: "1060881925603",
  appId: "1:1060881925603:web:7f8c5e06034c28fdcb8cd6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const boysCollection = collection(db, 'boys');

// Get all boys from Firestore
export async function getAllBoys(): Promise<BarMitzvahRecord[]> {
  try {
    const q = query(boysCollection, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BarMitzvahRecord));
  } catch (error) {
    console.error('Error fetching boys:', error);
    return [];
  }
}

// Add a new boy to Firestore
export async function addBoy(record: Omit<BarMitzvahRecord, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(boysCollection, {
      ...record,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding boy:', error);
    throw error;
  }
}

// Update a boy in Firestore
export async function updateBoy(id: string, updates: Partial<BarMitzvahRecord>): Promise<void> {
  try {
    await updateDoc(doc(db, 'boys', id), updates);
  } catch (error) {
    console.error('Error updating boy:', error);
    throw error;
  }
}

// Delete a boy from Firestore
export async function deleteBoy(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'boys', id));
  } catch (error) {
    console.error('Error deleting boy:', error);
    throw error;
  }
}

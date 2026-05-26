import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Patient, Doctor, Appointment, InventoryItem, ReportLog, AuditLog, Role } from '../types';
import { mockPatients, mockDoctors, mockAppointments, mockInventory, mockReportLogs } from '../data/mockData';
import { auth, db } from '../lib/firebase';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, updateDoc, getDoc, query, where } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firebase-errors';

interface AppContextData {
  currentUserRole: Role;
  setCurrentUserRole: (role: Role) => void;
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  inventory: InventoryItem[];
  reportLogs: ReportLog[];
  auditLogs: AuditLog[];
  
  // Basic CRUD for MVP
  addPatient: (p: Patient) => void;
  updatePatient: (p: Patient) => void;
  
  addDoctor: (d: Doctor) => void;
  updateDoctor: (d: Doctor) => void;
  
  addAppointment: (a: Appointment) => void;
  updateAppointment: (a: Appointment) => void;
  
  addInventoryItem: (i: InventoryItem) => void;
  updateInventoryItem: (i: InventoryItem) => void;
  
  addReportLog: (r: ReportLog) => void;
  addAuditLog: (a: AuditLog) => void;
  
  isDataLoaded: boolean;
}

const AppContext = createContext<AppContextData | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUserRole, setCurrentUserRole] = useState<Role>('reception');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.role) {
              setCurrentUserRole(data.role as Role);
            }
          } else {
             // Default if no role document is found
             setCurrentUserRole('reception');
          }
        } catch (error) {
          console.error("Error fetching user role", error);
        }
        setLoading(false);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    if (!user) {
      setIsDataLoaded(false);
      return;
    }
    
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 6) {
        setIsDataLoaded(true);
      }
    };

    // Subscribe to firestore collections
    const unsubPatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
      const data: Patient[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Patient));
      setPatients(data);
      checkLoaded();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'patients'));

    const unsubDoctors = onSnapshot(collection(db, 'doctors'), (snapshot) => {
      const data: Doctor[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Doctor));
      setDoctors(data);
      checkLoaded();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'doctors'));

    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      const data: Appointment[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(data);
      checkLoaded();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'));

    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const data: InventoryItem[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(data);
      checkLoaded();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory'));

    const unsubReports = onSnapshot(collection(db, 'reportLogs'), (snapshot) => {
      const data: ReportLog[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as ReportLog));
      setReportLogs(data);
      checkLoaded();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reportLogs'));

    let unsubAudit = () => {};
    if (currentUserRole === 'admin') {
      unsubAudit = onSnapshot(collection(db, 'auditLogs'), (snapshot) => {
        const data: AuditLog[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as AuditLog));
        setAuditLogs(data);
        checkLoaded();
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs'));
    } else {
      const q = query(collection(db, 'auditLogs'), where('userId', '==', user.uid));
      unsubAudit = onSnapshot(q, (snapshot) => {
        const data: AuditLog[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as AuditLog));
        setAuditLogs(data);
        checkLoaded();
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs'));
    }

    return () => {
      unsubPatients();
      unsubDoctors();
      unsubAppointments();
      unsubInventory();
      unsubReports();
      unsubAudit();
    };
  }, [user]);

  const addPatient = async (p: Patient) => {
    const { id, ...data } = p;
    try {
      await setDoc(doc(db, 'patients', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `patients/${id}`);
    }
  };
  
  const updatePatient = async (p: Patient) => {
    const { id, ...data } = p;
    try {
      // @ts-ignore
      await updateDoc(doc(db, 'patients', id), data);
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `patients/${id}`);
    }
  };

  const addDoctor = async (d: Doctor) => {
    const { id, ...data } = d;
    try {
      await setDoc(doc(db, 'doctors', id), data);
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, `doctors/${id}`);
    }
  };
  
  const updateDoctor = async (d: Doctor) => {
    const { id, ...data } = d;
    try {
      // @ts-ignore
      await updateDoc(doc(db, 'doctors', id), data);
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `doctors/${id}`);
    }
  };

  const addAppointment = async (a: Appointment) => {
    const { id, ...data } = a;
    try {
      await setDoc(doc(db, 'appointments', id), data);
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, `appointments/${id}`);
    }
  };
  
  const updateAppointment = async (a: Appointment) => {
    const { id, ...data } = a;
    try {
      // @ts-ignore
      await updateDoc(doc(db, 'appointments', id), data);
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`); // Added ignore to bypass deep partial type error
    }
  };

  const addInventoryItem = async (i: InventoryItem) => {
    const { id, ...data } = i;
    try {
      await setDoc(doc(db, 'inventory', id), data);
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, `inventory/${id}`);
    }
  };
  
  const updateInventoryItem = async (i: InventoryItem) => {
    const { id, ...data } = i;
    try {
      // @ts-ignore
      await updateDoc(doc(db, 'inventory', id), data);
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const addReportLog = async (r: ReportLog) => {
    const { id, ...data } = r;
    try {
      await setDoc(doc(db, 'reportLogs', id), data);
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, `reportLogs/${id}`);
    }
  };

  const addAuditLog = async (a: AuditLog) => {
    const { id, ...data } = a;
    try {
      await setDoc(doc(db, 'auditLogs', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `auditLogs/${id}`);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUserRole, setCurrentUserRole, user, loading, logout, isDataLoaded,
      patients, doctors, appointments, inventory, reportLogs, auditLogs,
      addPatient, updatePatient, addDoctor, updateDoctor,
      addAppointment, updateAppointment, addInventoryItem, updateInventoryItem, addReportLog, addAuditLog
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}

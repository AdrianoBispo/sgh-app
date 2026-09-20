import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Appointment, AuditLog, Doctor, InventoryItem, Patient, ReportLog, Role, SystemUser } from '../types';
import { auth, db } from '../lib/firebase';
import { OperationType, toAppError } from '../lib/firebase-errors';
import { generateId } from '../lib/id';
import { useToast } from '../components/ui/Toast';

/** Estado do perfil do usuário autenticado. */
export type RoleStatus = 'loading' | 'ready' | 'missing' | 'blocked';

export interface NewAuditLog {
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  details: string;
  beforeData?: unknown;
  afterData?: unknown;
}

interface AppContextData {
  currentUserRole: Role;
  roleStatus: RoleStatus;
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;

  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  inventory: InventoryItem[];
  reportLogs: ReportLog[];
  auditLogs: AuditLog[];
  systemUsers: SystemUser[];

  savePatient: (patient: Patient, mode: 'create' | 'update') => Promise<void>;
  saveDoctor: (doctor: Doctor, mode: 'create' | 'update') => Promise<void>;
  saveAppointment: (appointment: Appointment, mode: 'create' | 'update') => Promise<void>;
  saveInventoryItem: (item: InventoryItem, mode: 'create' | 'update') => Promise<void>;
  addReportLog: (report: ReportLog) => Promise<void>;
  /** Registra a trilha de auditoria; nunca derruba a operação principal. */
  recordAudit: (entry: NewAuditLog) => Promise<void>;

  isDataLoaded: boolean;
}

const AppContext = createContext<AppContextData | undefined>(undefined);

/** Coleções acompanhadas em tempo real e usadas no indicador de carregamento. */
const TRACKED_COLLECTIONS = ['patients', 'doctors', 'appointments', 'inventory', 'reportLogs', 'auditLogs'] as const;
type TrackedCollection = (typeof TRACKED_COLLECTIONS)[number];

const mapSnapshot = <T,>(snapshot: QuerySnapshot<DocumentData>): T[] =>
  snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as T);

/**
 * O Firestore recusa a gravação inteira ao encontrar `undefined` em qualquer
 * profundidade — o que acontece com facilidade nos retratos "antes/depois" da
 * auditoria, montados a partir de objetos com campos opcionais.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]),
    ) as T;
  }
  return value;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

  const [currentUserRole, setCurrentUserRole] = useState<Role>('reception');
  const [roleStatus, setRoleStatus] = useState<RoleStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loaded, setLoaded] = useState<Record<TrackedCollection, boolean>>(
    () => Object.fromEntries(TRACKED_COLLECTIONS.map((name) => [name, false])) as Record<TrackedCollection, boolean>,
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        setUser(null);
        setRoleStatus('loading');
        setLoading(false);
        return;
      }

      setUser(authUser);
      try {
        const profile = await getDoc(doc(db, 'users', authUser.uid));
        const data = profile.data();

        if (!profile.exists() || !data?.role) {
          // Sem perfil não há papel presumido: antes o sistema concedia
          // "reception" por padrão a qualquer conta autenticada.
          setRoleStatus('missing');
        } else if (data.status === 'inactive') {
          // O cadastro permitia bloquear um usuário, mas nada checava isso no login.
          setRoleStatus('blocked');
        } else {
          setCurrentUserRole(data.role as Role);
          setRoleStatus('ready');
        }
      } catch (error) {
        toAppError(error, OperationType.GET, `users/${authUser.uid}`);
        setRoleStatus('missing');
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setRoleStatus('loading');
  }, []);

  useEffect(() => {
    if (!user || roleStatus !== 'ready') {
      setLoaded(Object.fromEntries(TRACKED_COLLECTIONS.map((name) => [name, false])) as Record<TrackedCollection, boolean>);
      return;
    }

    const markLoaded = (name: TrackedCollection) => setLoaded((current) => ({ ...current, [name]: true }));

    /**
     * Um erro de leitura também encerra o carregamento. Antes um contador
     * único era incrementado só no caminho feliz, então qualquer coleção
     * negada pelas regras deixava a tela em esqueleto para sempre.
     */
    const subscribeError = (name: TrackedCollection, message: string) => (error: FirestoreError) => {
      markLoaded(name);
      toast.error(toAppError(error, OperationType.LIST, name).message + ` (${message})`);
    };

    const unsubscribers = [
      onSnapshot(
        collection(db, 'patients'),
        (snapshot) => {
          setPatients(mapSnapshot<Patient>(snapshot));
          markLoaded('patients');
        },
        subscribeError('patients', 'pacientes'),
      ),
      onSnapshot(
        collection(db, 'doctors'),
        (snapshot) => {
          setDoctors(mapSnapshot<Doctor>(snapshot));
          markLoaded('doctors');
        },
        subscribeError('doctors', 'profissionais'),
      ),
      onSnapshot(
        collection(db, 'appointments'),
        (snapshot) => {
          setAppointments(mapSnapshot<Appointment>(snapshot));
          markLoaded('appointments');
        },
        subscribeError('appointments', 'agendamentos'),
      ),
      onSnapshot(
        collection(db, 'inventory'),
        (snapshot) => {
          setInventory(
            mapSnapshot<InventoryItem>(snapshot).map((item) => ({
              ...item,
              quantity: Number(item.quantity) || 0,
              minQuantity: Number(item.minQuantity) || 0,
            })),
          );
          markLoaded('inventory');
        },
        subscribeError('inventory', 'estoque'),
      ),
      onSnapshot(
        collection(db, 'reportLogs'),
        (snapshot) => {
          setReportLogs(mapSnapshot<ReportLog>(snapshot));
          markLoaded('reportLogs');
        },
        subscribeError('reportLogs', 'relatórios'),
      ),
      onSnapshot(
        currentUserRole === 'admin'
          ? collection(db, 'auditLogs')
          : query(collection(db, 'auditLogs'), where('userId', '==', user.uid)),
        (snapshot) => {
          setAuditLogs(mapSnapshot<AuditLog>(snapshot));
          markLoaded('auditLogs');
        },
        subscribeError('auditLogs', 'auditoria'),
      ),
    ];

    if (currentUserRole === 'admin') {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'users'),
          (snapshot) => setSystemUsers(mapSnapshot<SystemUser>(snapshot)),
          (error) => toast.error(toAppError(error, OperationType.LIST, 'users').message + ' (usuários)'),
        ),
      );
    } else {
      setSystemUsers([]);
    }

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, roleStatus, currentUserRole, toast]);

  /**
   * Grava um documento. `create` usa `setDoc`; `update` usa `updateDoc` para
   * que as regras consigam comparar com o documento anterior.
   */
  const writeDocument = useCallback(
    async <T extends { id: string }>(collectionName: string, entity: T, mode: 'create' | 'update') => {
      const { id, ...data } = entity;
      const path = `${collectionName}/${id}`;
      const entries = Object.entries(data);

      try {
        if (mode === 'create') {
          // Campos `undefined` quebram o Firestore; removê-los aqui evita que
          // cada página precise montar o payload manualmente.
          const payload = Object.fromEntries(entries.filter(([, value]) => value !== undefined));
          await setDoc(doc(db, collectionName, id), stripUndefined(payload));
        } else {
          // Na atualização, um campo opcional esvaziado precisa ser removido do
          // documento — antes ele simplesmente permanecia com o valor antigo.
          const payload = Object.fromEntries(
            entries.map(([key, value]) => [key, value === undefined ? deleteField() : stripUndefined(value)]),
          );
          await updateDoc(doc(db, collectionName, id), payload as DocumentData);
        }
      } catch (error) {
        throw toAppError(error, mode === 'create' ? OperationType.CREATE : OperationType.UPDATE, path);
      }
    },
    [],
  );

  const savePatient = useCallback(
    (patient: Patient, mode: 'create' | 'update') => writeDocument('patients', patient, mode),
    [writeDocument],
  );
  const saveDoctor = useCallback(
    (entity: Doctor, mode: 'create' | 'update') => writeDocument('doctors', entity, mode),
    [writeDocument],
  );
  const saveAppointment = useCallback(
    (appointment: Appointment, mode: 'create' | 'update') => writeDocument('appointments', appointment, mode),
    [writeDocument],
  );
  const saveInventoryItem = useCallback(
    (item: InventoryItem, mode: 'create' | 'update') => writeDocument('inventory', item, mode),
    [writeDocument],
  );
  const addReportLog = useCallback(
    (report: ReportLog) => writeDocument('reportLogs', report, 'create'),
    [writeDocument],
  );

  const recordAudit = useCallback(
    async (entry: NewAuditLog) => {
      if (!user) return;
      try {
        await writeDocument(
          'auditLogs',
          stripUndefined({
            ...entry,
            id: generateId(),
            userId: user.uid,
            timestamp: new Date().toISOString(),
          }),
          'create',
        );
      } catch (error) {
        // A auditoria é complementar: registra no console e avisa discretamente,
        // mas nunca desfaz nem bloqueia a operação que o usuário concluiu.
        console.error('Falha ao registrar auditoria', error);
        toast.warning('A ação foi salva, mas não foi possível registrar a auditoria.');
      }
    },
    [user, writeDocument, toast],
  );

  const isDataLoaded = useMemo(() => TRACKED_COLLECTIONS.every((name) => loaded[name]), [loaded]);

  const value = useMemo<AppContextData>(
    () => ({
      currentUserRole,
      roleStatus,
      user,
      loading,
      logout,
      patients,
      doctors,
      appointments,
      inventory,
      reportLogs,
      auditLogs,
      systemUsers,
      savePatient,
      saveDoctor,
      saveAppointment,
      saveInventoryItem,
      addReportLog,
      recordAudit,
      isDataLoaded,
    }),
    [
      currentUserRole, roleStatus, user, loading, logout,
      patients, doctors, appointments, inventory, reportLogs, auditLogs, systemUsers,
      savePatient, saveDoctor, saveAppointment, saveInventoryItem, addReportLog, recordAudit, isDataLoaded,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}

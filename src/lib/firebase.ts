import { initializeApp, getApp, getApps, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const config = firebaseConfig as FirebaseOptions & { firestoreDatabaseId?: string };

/** Reaproveita a instância já criada (evita erro em HMR e em testes). */
export const app = getApps().length ? getApp() : initializeApp(config);

export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

/**
 * App secundário usado só para criar contas sem derrubar a sessão do admin.
 * Criado sob demanda: antes era instanciado no topo de `Usuarios.tsx` e
 * subia um segundo cliente Firebase em todo carregamento da aplicação.
 */
export function getSecondaryAuth() {
  const secondary = getApps().find((instance) => instance.name === 'Secondary') ?? initializeApp(config, 'Secondary');
  return getAuth(secondary);
}

import { FirebaseError } from 'firebase/app';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/** Mensagens em português para os códigos que o usuário final pode provocar. */
const FIRESTORE_MESSAGES: Record<string, string> = {
  'permission-denied': 'Seu perfil não tem permissão para esta operação, ou os dados enviados não passaram nas regras de validação.',
  unauthenticated: 'Sua sessão expirou. Entre novamente para continuar.',
  unavailable: 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.',
  'deadline-exceeded': 'O servidor demorou para responder. Tente novamente em instantes.',
  'not-found': 'O registro não foi encontrado. Ele pode ter sido removido por outro usuário.',
  'already-exists': 'Já existe um registro com este identificador.',
  'failed-precondition': 'A operação não pôde ser concluída no estado atual dos dados.',
  'resource-exhausted': 'Limite de uso do banco atingido. Tente novamente mais tarde.',
  cancelled: 'A operação foi cancelada antes de terminar.',
};

export const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/user-disabled': 'Esta conta está desativada. Procure um administrador.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar de novo.',
  'auth/network-request-failed': 'Falha de rede ao contatar o servidor de autenticação.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password': 'A senha precisa ter ao menos 6 caracteres.',
  'auth/requires-recent-login': 'Por segurança, entre novamente antes de repetir esta ação.',
};

/** Erro de domínio, seguro para exibir na interface. */
export class AppError extends Error {
  readonly code: string;
  readonly operationType: OperationType;
  readonly path: string | null;

  constructor(message: string, code: string, operationType: OperationType, path: string | null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.operationType = operationType;
    this.path = path;
  }
}

function errorCode(error: unknown): string {
  if (error instanceof FirebaseError) return error.code.replace(/^firestore\//, '');
  if (typeof error === 'object' && error && 'code' in error) return String((error as { code: unknown }).code);
  return 'unknown';
}

/** Mensagem amigável a partir de um erro de autenticação. */
export function authErrorMessage(error: unknown): string {
  return AUTH_MESSAGES[errorCode(error)] ?? 'Não foi possível concluir a operação. Tente novamente.';
}

/**
 * Converte um erro do Firestore em `AppError`.
 *
 * A versão anterior montava um JSON com uid, e-mail e provedores do usuário e
 * o lançava como mensagem de erro — esse texto chegava a aparecer em `alert()`
 * na tela. Aqui os dados sensíveis ficam apenas no console de depuração.
 */
export function toAppError(error: unknown, operationType: OperationType, path: string | null): AppError {
  const code = errorCode(error);
  const message = FIRESTORE_MESSAGES[code] ?? 'Não foi possível concluir a operação. Tente novamente.';

  if (import.meta.env.DEV) {
    console.error(`[Firestore:${operationType}] ${path ?? '-'} (${code})`, error);
  } else {
    console.error(`[Firestore:${operationType}] ${path ?? '-'} (${code})`);
  }

  return new AppError(message, code, operationType, path);
}

/** Normaliza qualquer erro em texto exibível. */
export function describeError(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof FirebaseError) return authErrorMessage(error);
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

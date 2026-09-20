import { FormEvent, ReactNode, Suspense, lazy, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Eye, EyeOff, HeartPulse, Loader2, ShieldAlert } from 'lucide-react';
import { AppProvider, useAppContext } from './context/AppContext';
import { ToastProvider } from './components/ui/Toast';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';

// As demais páginas entram por code splitting: quem só abre o dashboard não
// baixa o código de estoque, relatórios ou gestão de usuários.
const Pacientes = lazy(() => import('./pages/Pacientes').then((module) => ({ default: module.Pacientes })));
const Agendamentos = lazy(() => import('./pages/Agendamentos').then((module) => ({ default: module.Agendamentos })));
const Estoque = lazy(() => import('./pages/Estoque').then((module) => ({ default: module.Estoque })));
const Relatorios = lazy(() => import('./pages/Relatorios').then((module) => ({ default: module.Relatorios })));
const Usuarios = lazy(() => import('./pages/Usuarios').then((module) => ({ default: module.Usuarios })));
import { auth } from './lib/firebase';
import { authErrorMessage } from './lib/firebase-errors';
import { APP_NAME, APP_TAGLINE, NAV_ITEMS } from './lib/navigation';
import { Role } from './types';

const PAGES: Record<string, ReactNode> = {
  '/pacientes': <Pacientes />,
  '/agendamentos': <Agendamentos />,
  '/estoque': <Estoque />,
  '/relatorios': <Relatorios />,
  '/usuarios': <Usuarios />,
};

function PageFallback() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-gray-500">
      <Loader2 className="h-5 w-5 animate-spin text-primary-600" aria-hidden="true" />
      Carregando módulo...
    </div>
  );
}

function FullScreenMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      {children}
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (authLoading) return;

    setError('');
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div>
          <div className="mb-6 flex items-center justify-center gap-4 border-b border-gray-100 pb-6">
            <HeartPulse className="h-12 w-12 text-emerald-600" aria-hidden="true" />
            <div className="flex flex-col items-start">
              <h1 className="text-3xl font-bold leading-tight text-gray-900">{APP_NAME}</h1>
              <span className="text-sm font-medium tracking-wide text-gray-500">{APP_TAGLINE}</span>
            </div>
          </div>
          <h2 className="text-center text-xl font-semibold text-gray-700">Entrar no sistema</h2>
          <p className="mt-2 text-center text-sm text-gray-500">O acesso é restrito a profissionais autorizados.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <div aria-live="polite">
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-center text-sm text-red-600">{error}</div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2 pr-11 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {authLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {authLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, roleStatus, logout } = useAppContext();

  if (loading) {
    return (
      <FullScreenMessage title="Carregando...">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-hidden="true" />
      </FullScreenMessage>
    );
  }

  if (!user) return <LoginScreen />;

  if (roleStatus === 'missing' || roleStatus === 'blocked') {
    return (
      <FullScreenMessage title={roleStatus === 'blocked' ? 'Acesso bloqueado' : 'Perfil não configurado'}>
        <ShieldAlert className="h-10 w-10 text-amber-500" aria-hidden="true" />
        <p className="max-w-sm text-sm text-gray-600">
          {roleStatus === 'blocked'
            ? 'Esta conta está inativa no sistema. Procure um administrador para reativá-la.'
            : 'Sua conta não possui um perfil de acesso cadastrado. Solicite a um administrador que conclua o cadastro.'}
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Sair
        </button>
      </FullScreenMessage>
    );
  }

  return <>{children}</>;
}

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: Role[] }) {
  const { currentUserRole } = useAppContext();
  const location = useLocation();

  if (allowedRoles && !allowedRoles.includes(currentUserRole)) {
    return <Navigate to="/" replace state={{ deniedFrom: location.pathname }} />;
  }

  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
      <h2 className="text-xl font-bold text-gray-800">Página não encontrada</h2>
      <p className="text-sm text-gray-500">O endereço acessado não existe ou foi movido.</p>
      <a href="/" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700">
        Voltar ao dashboard
      </a>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AuthGate>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                {NAV_ITEMS.filter((item) => item.to !== '/').map((item) => (
                  <Route
                    key={item.to}
                    path={item.to.slice(1)}
                    element={
                      <ProtectedRoute allowedRoles={item.roles}>
                        <Suspense fallback={<PageFallback />}>{PAGES[item.to]}</Suspense>
                      </ProtectedRoute>
                    }
                  />
                ))}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthGate>
      </AppProvider>
    </ToastProvider>
  );
}

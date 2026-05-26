import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { Role } from './types';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Pacientes } from './pages/Pacientes';
import { Medicos } from './pages/Medicos';
import { Agendamentos } from './pages/Agendamentos';
import { Estoque } from './pages/Estoque';
import { Relatorios } from './pages/Relatorios';

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAppContext();
  const [isLogin, setIsLogin] = React.useState(true);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<Role>('reception');
  const [error, setError] = React.useState('');
  const [authLoading, setAuthLoading] = React.useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Caregando...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          name: name,
          role: role
        });
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold text-center text-gray-900 border-b border-gray-100 pb-4 mb-4">Hospital São Gabriel</h1>
            <h2 className="text-center text-xl font-semibold text-gray-700">
              {isLogin ? 'Entrar no Sistema' : 'Criar uma Conta'}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-500">
              O acesso é restrito a profissionais autorizados.
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 text-center">
                {error}
              </div>
            )}
            <div className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    placeholder="Seu nome"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Setor / Função</label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                  >
                    <option value="reception">Recepção</option>
                    <option value="nurse">Enfermagem</option>
                    <option value="doctor">Corpo Clínico (Médico)</option>
                    <option value="pharmacy">Farmácia</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
              </button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); setName(''); setEmail(''); setPassword(''); }}
                className="text-sm font-medium text-primary-600 hover:text-primary-500 transition"
              >
                {isLogin ? 'Não tem uma conta? Solicitar cadastro.' : 'Já possui uma conta? Faça login.'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <AuthWrapper>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="pacientes" element={<Pacientes />} />
              <Route path="medicos" element={<Medicos />} />
              <Route path="agendamentos" element={<Agendamentos />} />
              <Route path="estoque" element={<Estoque />} />
              <Route path="relatorios" element={<Relatorios />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthWrapper>
    </AppProvider>
  );
}

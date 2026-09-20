import { Calendar, FileText, LayoutDashboard, LucideIcon, Package, Stethoscope, Users } from 'lucide-react';
import { Role } from '../types';

export interface NavItem {
  name: string;
  to: string;
  icon: LucideIcon;
  /** Perfis com acesso. Ausente = liberado para todos os autenticados. */
  roles?: Role[];
  /** Texto exibido como subtítulo do cabeçalho. */
  subtitle: string;
}

/**
 * Fonte única de verdade da navegação: menu lateral, título do cabeçalho e as
 * rotas protegidas saem daqui. Antes cada arquivo tinha sua própria lista e
 * elas divergiram (o cabeçalho ainda apontava para `/medicos`, removida, e
 * não conhecia `/usuarios`).
 */
export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard, subtitle: 'Visão geral' },
  { name: 'Pacientes', to: '/pacientes', icon: Users, roles: ['admin', 'reception', 'doctor'], subtitle: 'Cadastro e histórico de pacientes' },
  { name: 'Agendamentos', to: '/agendamentos', icon: Calendar, roles: ['admin', 'reception', 'doctor'], subtitle: 'Agenda de consultas e exames' },
  { name: 'Estoque', to: '/estoque', icon: Package, roles: ['admin', 'pharmacy'], subtitle: 'Farmácia e insumos' },
  { name: 'Relatórios', to: '/relatorios', icon: FileText, roles: ['admin', 'reception'], subtitle: 'Indicadores e trilha de auditoria' },
  { name: 'Usuários', to: '/usuarios', icon: Stethoscope, roles: ['admin'], subtitle: 'Equipe e permissões de acesso' },
];

export const canAccess = (item: NavItem, role: Role): boolean => !item.roles || item.roles.includes(role);

export const navigationFor = (role: Role): NavItem[] => NAV_ITEMS.filter((item) => canAccess(item, role));

export const ROLE_NAMES: Record<Role, string> = {
  admin: 'Administrador',
  reception: 'Recepção',
  doctor: 'Médico(a)',
  pharmacy: 'Farmacêutico(a)',
};

/** Nome comercial do sistema, usado no cabeçalho, no login e nos PDFs. */
export const APP_NAME = 'Serene';
export const APP_TAGLINE = 'CLINIC SYSTEM';
export const CLINIC_NAME = 'Hospital São Gabriel';

export function pageTitle(pathname: string): { title: string; subtitle: string } {
  const match = NAV_ITEMS.find((item) => item.to === pathname) ?? NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to));
  return { title: match?.name ?? 'Página não encontrada', subtitle: match?.subtitle ?? 'Verifique o endereço acessado' };
}

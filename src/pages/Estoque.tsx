import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, CalendarX2, MinusCircle, PackageX, Plus, Search } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Modal } from '../components/ui/Modal';
import { ImportExportButtons } from '../components/ui/ImportExportButtons';
import { useToast } from '../components/ui/Toast';
import { InventoryItem } from '../types';
import { EXPIRY_WARNING_DAYS, getStockHealth, summarizeInventory } from '../lib/inventory';
import { SpreadsheetRow, readField } from '../lib/spreadsheet';
import { describeError } from '../lib/firebase-errors';
import { formatDateBR, formatDateTimeBR, todayISO } from '../lib/date';
import { generateId, sanitizeId } from '../lib/id';
import { cn } from '../lib/utils';

/** Ações registradas na trilha de auditoria do estoque. */
const AUDIT_ACTIONS = {
  entry: 'Entrada de Estoque',
  exit: 'Saída de Estoque',
  adjust: 'Ajuste de Estoque',
  update: 'Atualização de Cadastro',
  deactivate: 'Exclusão Lógica (Estoque)',
  activate: 'Reativação de Item',
} as const;

const ACTION_STYLES: Record<string, string> = {
  [AUDIT_ACTIONS.entry]: 'text-emerald-700',
  [AUDIT_ACTIONS.exit]: 'text-amber-700',
  [AUDIT_ACTIONS.adjust]: 'text-blue-700',
  [AUDIT_ACTIONS.update]: 'text-blue-700',
  [AUDIT_ACTIONS.deactivate]: 'text-red-700',
  [AUDIT_ACTIONS.activate]: 'text-emerald-700',
};

export function Estoque() {
  const { inventory, saveInventoryItem, currentUserRole, isDataLoaded, recordAudit, auditLogs } = useAppContext();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [withdrawModal, setWithdrawModal] = useState<{ isOpen: boolean; item: InventoryItem | null }>({ isOpen: false, item: null });
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = currentUserRole === 'admin' || currentUserRole === 'pharmacy';
  const summary = useMemo(() => summarizeInventory(inventory), [inventory]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return inventory
      .filter((item) => {
        const matchesSearch = !term || item.name.toLowerCase().includes(term) || item.batch.toLowerCase().includes(term);
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        const health = getStockHealth(item);
        const matchesAlert =
          alertFilter === 'all' ||
          (alertFilter === 'low' && (health.level === 'low' || health.level === 'out')) ||
          (alertFilter === 'expiring' && health.expiry !== 'ok');
        return matchesSearch && matchesStatus && matchesAlert;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [inventory, searchTerm, statusFilter, alertFilter]);

  const { displayedItems, loadMoreRef, hasMore } = useInfiniteScroll(
    filteredItems,
    15,
    `${searchTerm}|${statusFilter}|${alertFilter}`,
  );

  const itemHistory = useMemo(() => {
    if (!editingItem) return [];
    return auditLogs
      .filter((log) => log.entityId === editingItem.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, editingItem]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const quantity = Number(formData.get('quantity'));
    const minQuantity = Number(formData.get('minQuantity'));
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(minQuantity) || minQuantity < 0) {
      toast.error('Quantidades devem ser números maiores ou iguais a zero.');
      return;
    }

    const item: InventoryItem = {
      id: editingItem?.id ?? generateId(),
      name: String(formData.get('name') ?? '').trim(),
      batch: String(formData.get('batch') ?? '').trim(),
      expiryDate: String(formData.get('expiryDate') ?? ''),
      quantity,
      minQuantity,
      // O seletor de status só é renderizado para o admin. Sem este fallback,
      // um farmacêutico que editasse um item inativo o reativava sem querer.
      status: (formData.get('status') as InventoryItem['status']) ?? editingItem?.status ?? 'active',
    };

    setIsSaving(true);
    try {
      await saveInventoryItem(item, editingItem ? 'update' : 'create');

      if (!editingItem) {
        await recordAudit({
          action: AUDIT_ACTIONS.entry,
          entityType: 'Estoque',
          entityId: item.id,
          entityName: item.name,
          details: `Cadastro inicial com ${item.quantity} unidade(s).`,
          afterData: item,
        });
      } else {
        const difference = item.quantity - editingItem.quantity;
        const statusChanged = editingItem.status !== item.status;
        const dataChanged =
          editingItem.name !== item.name ||
          editingItem.batch !== item.batch ||
          editingItem.expiryDate !== item.expiryDate ||
          editingItem.minQuantity !== item.minQuantity;

        // Antes só a entrada era registrada: reduzir a quantidade pelo
        // formulário saía do saldo sem deixar rastro na auditoria.
        const action = difference > 0
          ? AUDIT_ACTIONS.entry
          : difference < 0
            ? AUDIT_ACTIONS.adjust
            : statusChanged
              ? item.status === 'inactive'
                ? AUDIT_ACTIONS.deactivate
                : AUDIT_ACTIONS.activate
              : AUDIT_ACTIONS.update;

        const details = difference !== 0
          ? `${difference > 0 ? 'Entrada' : 'Baixa'} de ${Math.abs(difference)} unidade(s) via edição (${editingItem.quantity} → ${item.quantity}).`
          : statusChanged
            ? `Item marcado como ${item.status === 'inactive' ? 'inativo' : 'ativo'}.`
            : 'Atualizou os dados cadastrais do item.';

        if (difference !== 0 || statusChanged || dataChanged) {
          await recordAudit({
            action,
            entityType: 'Estoque',
            entityId: item.id,
            entityName: item.name,
            details,
            beforeData: editingItem,
            afterData: item,
          });
        }
      }

      toast.success(editingItem ? 'Item atualizado.' : 'Item cadastrado no estoque.');
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível salvar o item.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleWithdraw = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const item = withdrawModal.item;
    if (!item) return;

    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get('withdrawAmount'));
    const reason = String(formData.get('reason') ?? '').trim();

    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error('Informe uma quantidade inteira maior que zero.');
      return;
    }
    if (amount > item.quantity) {
      toast.error(`Saldo insuficiente: há apenas ${item.quantity} unidade(s) do lote ${item.batch}.`);
      return;
    }
    if (!reason) {
      toast.error('O motivo da retirada é obrigatório.');
      return;
    }

    const updated = { ...item, quantity: item.quantity - amount };
    setIsSaving(true);
    try {
      await saveInventoryItem(updated, 'update');
      await recordAudit({
        action: AUDIT_ACTIONS.exit,
        entityType: 'Estoque',
        entityId: item.id,
        entityName: item.name,
        details: `Retirada de ${amount} unidade(s). Motivo: ${reason}`,
        beforeData: item,
        afterData: updated,
      });
      toast.success(`Saída de ${amount} unidade(s) registrada.`);
      setWithdrawModal({ isOpen: false, item: null });
      setEditingItem(updated);
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível registrar a saída.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (rows: SpreadsheetRow[]) => {
    let imported = 0;
    const problems: string[] = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const name = readField(row, 'name', 'nome', 'produto');
      const batch = readField(row, 'batch', 'lote');
      if (!name || !batch) {
        problems.push(`Linha ${line}: nome e lote são obrigatórios.`);
        continue;
      }

      const item: InventoryItem = {
        id: sanitizeId(readField(row, 'id')) ?? generateId(),
        name,
        batch,
        expiryDate: readField(row, 'expiryDate', 'validade') || todayISO(),
        quantity: Math.max(0, Number(readField(row, 'quantity', 'quantidade')) || 0),
        minQuantity: Math.max(0, Number(readField(row, 'minQuantity', 'minimo', 'quantidadeMinima')) || 0),
        status: readField(row, 'status') === 'inactive' ? 'inactive' : 'active',
      };

      try {
        await saveInventoryItem(item, 'create');
        await recordAudit({
          action: AUDIT_ACTIONS.entry,
          entityType: 'Estoque',
          entityId: item.id,
          entityName: item.name,
          details: `Importação de planilha com ${item.quantity} unidade(s).`,
          afterData: item,
        });
        imported++;
      } catch (error) {
        problems.push(`Linha ${line}: ${describeError(error, 'falha ao gravar.')}`);
      }
    }

    if (imported > 0) toast.success(`${imported} item(ns) importado(s).`);
    if (problems.length > 0) {
      toast.warning(`${problems.length} linha(s) ignorada(s). ${problems.slice(0, 2).join(' ')}`);
      console.warn('Importação de estoque:', problems);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ImportExportButtons onImport={handleImport} exportData={inventory} exportFileName="estoque" canImport={canEdit} />
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setActiveTab('dados');
              setIsModalOpen(true);
            }}
            className="ml-auto flex items-center whitespace-nowrap rounded-xl bg-gray-900 px-4 py-2.5 font-medium text-white transition hover:bg-gray-800"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Novo item
          </button>
        )}
      </div>

      {isDataLoaded && summary.attention > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="flex-1">
            <strong>{summary.attention} item(ns)</strong> exigem atenção:{' '}
            {[
              summary.out > 0 && `${summary.out} sem saldo`,
              summary.low > 0 && `${summary.low} abaixo do mínimo`,
              summary.expired > 0 && `${summary.expired} vencido(s)`,
              summary.expiring > 0 && `${summary.expiring} vencendo em ${EXPIRY_WARNING_DAYS} dias`,
            ]
              .filter(Boolean)
              .join(' · ')}
            .
          </p>
          <button
            type="button"
            onClick={() => setAlertFilter(summary.expired + summary.expiring > 0 ? 'expiring' : 'low')}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-800 transition hover:bg-amber-100"
          >
            Filtrar pendências
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:flex-wrap">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar item por nome ou lote"
              placeholder="Buscar por nome ou lote..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar por status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todos os status</option>
            <option value="active">Apenas ativos</option>
            <option value="inactive">Apenas inativos</option>
          </select>
          <select
            aria-label="Filtrar por alerta"
            value={alertFilter}
            onChange={(event) => setAlertFilter(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todos os alertas</option>
            <option value="low">Saldo baixo ou zerado</option>
            <option value="expiring">Vencidos ou a vencer</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-gray-50 font-medium text-gray-600">
              <tr>
                <th scope="col" className="px-6 py-3">Produto</th>
                <th scope="col" className="px-6 py-3">Lote</th>
                <th scope="col" className="px-6 py-3">Validade</th>
                <th scope="col" className="px-6 py-3">Quantidade</th>
                <th scope="col" className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {!isDataLoaded ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-3/4 rounded bg-gray-200" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-gray-200" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 rounded-full bg-gray-200" /></td>
                  </tr>
                ))
              ) : displayedItems.length > 0 ? (
                displayedItems.map((item) => {
                  const health = getStockHealth(item);
                  return (
                    <tr key={item.id} className="transition hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setActiveTab('dados');
                            setIsModalOpen(true);
                          }}
                          className="flex items-center gap-2 rounded text-left transition hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          {item.name}
                          {health.level !== 'ok' && (
                            <span title={health.level === 'out' ? 'Sem saldo' : 'Estoque mínimo atingido'}>
                              {health.level === 'out' ? (
                                <PackageX className="h-4 w-4 text-red-500" aria-label="Sem saldo" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Estoque mínimo atingido" />
                              )}
                            </span>
                          )}
                          {health.expiry !== 'ok' && (
                            <span title={health.expiry === 'expired' ? 'Lote vencido' : 'Lote próximo do vencimento'}>
                              <CalendarX2
                                className={cn('h-4 w-4', health.expiry === 'expired' ? 'text-red-500' : 'text-amber-500')}
                                aria-label={health.expiry === 'expired' ? 'Lote vencido' : 'Lote próximo do vencimento'}
                              />
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600">{item.batch}</td>
                      <td className={cn('px-6 py-4', health.expiry === 'expired' ? 'font-semibold text-red-600' : health.expiry === 'expiring' ? 'text-amber-600' : '')}>
                        {formatDateBR(item.expiryDate)}
                        {health.expiry === 'expiring' && <span className="ml-1 text-xs">({health.daysToExpiry}d)</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(health.level !== 'ok' ? 'font-bold text-amber-600' : '')}>{item.quantity}</span>
                        <span className="ml-1 text-xs font-normal text-gray-400">(mín.: {item.minQuantity})</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium',
                            item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700',
                          )}
                        >
                          {item.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    {inventory.length === 0 ? 'Nenhum item cadastrado no estoque.' : 'Nenhum item encontrado com estes filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hasMore && (
            <div ref={loadMoreRef} className="flex h-10 items-center justify-center text-sm text-gray-400">
              Carregando mais...
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveTab('dados');
        }}
        title={editingItem ? 'Gerenciar item' : 'Novo item no estoque'}
        className="max-w-2xl"
      >
        <div className="mb-4 flex gap-2 border-b border-gray-200" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'dados'}
            onClick={() => setActiveTab('dados')}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition',
              activeTab === 'dados' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            Dados do item
          </button>
          {editingItem && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'historico'}
              onClick={() => setActiveTab('historico')}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition',
                activeTab === 'historico' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              Histórico ({itemHistory.length})
            </button>
          )}
        </div>

        {activeTab === 'dados' ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="item-name" className="mb-1 block text-sm font-medium text-gray-700">Nome do produto</label>
                <input id="item-name" required name="name" defaultValue={editingItem?.name} disabled={!canEdit} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50" />
              </div>
              <div>
                <label htmlFor="item-batch" className="mb-1 block text-sm font-medium text-gray-700">Lote</label>
                <input id="item-batch" required name="batch" defaultValue={editingItem?.batch} disabled={!canEdit} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50" />
              </div>
              <div>
                <label htmlFor="item-expiry" className="mb-1 block text-sm font-medium text-gray-700">Data de validade</label>
                <input id="item-expiry" required type="date" name="expiryDate" defaultValue={editingItem?.expiryDate} disabled={!canEdit} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50" />
              </div>
              <div>
                <label htmlFor="item-quantity" className="mb-1 block text-sm font-medium text-gray-700">Quantidade atual</label>
                <input id="item-quantity" required type="number" min="0" step="1" name="quantity" defaultValue={editingItem?.quantity ?? 0} disabled={!canEdit} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50" />
              </div>
              <div>
                <label htmlFor="item-min" className="mb-1 block text-sm font-medium text-gray-700">Quantidade mínima (alerta)</label>
                <input id="item-min" required type="number" min="0" step="1" name="minQuantity" defaultValue={editingItem?.minQuantity ?? 0} disabled={!canEdit} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50" />
              </div>
              {currentUserRole === 'admin' && (
                <div className="md:col-span-2">
                  <label htmlFor="item-status" className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                  <select id="item-status" name="status" defaultValue={editingItem?.status || 'active'} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo (descartado / fora de uso)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-between">
              <div>
                {canEdit && editingItem && (
                  <button
                    type="button"
                    onClick={() => setWithdrawModal({ isOpen: true, item: editingItem })}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    <MinusCircle className="h-4 w-4" aria-hidden="true" />
                    Registrar saída
                  </button>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setActiveTab('dados');
                  }}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
                >
                  {canEdit ? 'Cancelar' : 'Fechar'}
                </button>
                {canEdit && (
                  <button type="submit" disabled={isSaving} className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60">
                    {isSaving ? 'Salvando...' : 'Salvar item'}
                  </button>
                )}
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-2">
            <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
              {itemHistory.length > 0 ? (
                itemHistory.map((log) => (
                  <div key={log.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      {/* Os rótulos agora usam as mesmas ações gravadas na auditoria;
                          antes comparava-se com 'UPDATE'/'STOCK_WITHDRAW', que nunca
                          eram gravadas, e tudo aparecia como "Atualização". */}
                      <span className={cn('font-semibold', ACTION_STYLES[log.action] ?? 'text-gray-700')}>{log.action}</span>
                      <span className="text-xs text-gray-500">{formatDateTimeBR(log.timestamp)}</span>
                    </div>
                    <p className="text-gray-700">{log.details}</p>
                    <p className="mt-1 font-mono text-xs text-gray-400">Por: {log.userId}</p>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-gray-500">
                  Nenhum registro encontrado para este item.
                  {currentUserRole !== 'admin' && ' Apenas administradores visualizam a trilha completa.'}
                </p>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setActiveTab('dados');
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={withdrawModal.isOpen}
        onClose={() => setWithdrawModal({ isOpen: false, item: null })}
        title="Registrar saída (retirada)"
      >
        <form onSubmit={handleWithdraw} className="space-y-4">
          {withdrawModal.item && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-800">{withdrawModal.item.name}</p>
              <p className="text-sm text-gray-500">
                Lote: {withdrawModal.item.batch} · Em estoque: {withdrawModal.item.quantity} · Validade:{' '}
                {formatDateBR(withdrawModal.item.expiryDate)}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="withdraw-amount" className="mb-1 block text-sm font-medium text-gray-700">Quantidade a retirar</label>
            <input
              id="withdraw-amount"
              required
              type="number"
              min="1"
              step="1"
              max={withdrawModal.item?.quantity || 1}
              name="withdrawAmount"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="withdraw-reason" className="mb-1 block text-sm font-medium text-gray-700">Motivo / vínculo (obrigatório)</label>
            <textarea
              id="withdraw-reason"
              required
              name="reason"
              rows={2}
              placeholder="Ex.: Receituário do paciente X, descarte por vencimento..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setWithdrawModal({ isOpen: false, item: null })} className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60">
              {isSaving ? 'Registrando...' : 'Confirmar retirada'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

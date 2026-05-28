import React, { useState } from 'react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useAppContext } from '../context/AppContext';
import { Search, Plus, Edit2, AlertTriangle, MinusCircle } from 'lucide-react';
import { InventoryItem } from '../types';
import { Modal } from '../components/ui/Modal';
import { ImportExportButtons } from '../components/ui/ImportExportButtons';

export function Estoque() {
  const { inventory, addInventoryItem, updateInventoryItem, currentUserRole, user, isDataLoaded, addAuditLog, auditLogs } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [withdrawModal, setWithdrawModal] = useState<{isOpen: boolean; item: InventoryItem | null}>({isOpen: false, item: null});
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');

  const canEdit = currentUserRole === 'admin' || currentUserRole === 'pharmacy';

  const filteredItems = inventory.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.batch.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { displayedItems, loadMoreRef, hasMore } = useInfiniteScroll(filteredItems, 15);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newItem: InventoryItem = {
      id: editingItem?.id || Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      batch: formData.get('batch') as string,
      expiryDate: formData.get('expiryDate') as string,
      quantity: parseInt(formData.get('quantity') as string, 10),
      minQuantity: parseInt(formData.get('minQuantity') as string, 10),
      status: (formData.get('status') as any) || 'active',
    };

    if (editingItem) {
      updateInventoryItem(newItem);
      
      const qtyDiff = newItem.quantity - editingItem.quantity;
      if (qtyDiff > 0) {
        addAuditLog({
          id: Math.random().toString(36).substr(2, 9),
          action: 'Entrada de Estoque',
          entityType: 'Estoque',
          entityId: newItem.id,
          entityName: newItem.name,
          details: `Entrada de ${qtyDiff} unidade(s). (Atualização)`,
          userId: user?.uid || currentUserRole || 'unknown',
          timestamp: new Date().toISOString(),
          beforeData: editingItem,
          afterData: newItem
        });
      } else if (editingItem.status === 'active' && newItem.status === 'inactive') {
        addAuditLog({
          id: Math.random().toString(36).substr(2, 9),
          action: 'Exclusão Lógica (Estoque)',
          entityType: 'Estoque',
          entityId: newItem.id,
          entityName: newItem.name,
          details: `Desativou o item ${newItem.name} (Lote: ${newItem.batch})`,
          userId: user?.uid || currentUserRole || 'unknown',
          timestamp: new Date().toISOString(),
          beforeData: editingItem,
          afterData: newItem
        });
      } else if (qtyDiff === 0 && (editingItem.name !== newItem.name || editingItem.batch !== newItem.batch || editingItem.expiryDate !== newItem.expiryDate)) {
         addAuditLog({
          id: Math.random().toString(36).substr(2, 9),
          action: 'Atualização de Cadastro',
          entityType: 'Estoque',
          entityId: newItem.id,
          entityName: newItem.name,
          details: `Atualizou os dados do item.`,
          userId: user?.uid || currentUserRole || 'unknown',
          timestamp: new Date().toISOString(),
          beforeData: editingItem,
          afterData: newItem
        });
      }
    } else {
      addInventoryItem(newItem);
      addAuditLog({
          id: Math.random().toString(36).substr(2, 9),
          action: 'Entrada de Estoque',
          entityType: 'Estoque',
          entityId: newItem.id,
          entityName: newItem.name,
          details: `Cadastro inicial com ${newItem.quantity} unidade(s).`,
          userId: user?.uid || currentUserRole || 'unknown',
          timestamp: new Date().toISOString(),
          afterData: newItem
        });
    }
    
    setIsModalOpen(false);
  };

  const handleImport = async (data: any[]) => {
    let count = 0;
    for (const row of data) {
      if (row.name && row.batch) {
        const newItem: InventoryItem = {
          id: row.id || Math.random().toString(36).substr(2, 9),
          name: row.name,
          batch: row.batch,
          expiryDate: row.expiryDate || new Date().toISOString().split('T')[0],
          quantity: parseInt(row.quantity, 10) || 0,
          minQuantity: parseInt(row.minQuantity, 10) || 0,
          status: row.status === 'inactive' ? 'inactive' : 'active'
        };
        addInventoryItem(newItem);
        count++;
      }
    }
    if (count > 0) alert(`${count} item(ns) importado(s) com sucesso no estoque!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {canEdit && (
          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <ImportExportButtons 
              onImport={handleImport}
              exportData={inventory}
              exportFileName="estoque"
            />
            <button 
              onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
              className="flex items-center px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Item
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar por nome ou lote..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Apenas Ativos</option>
            <option value="inactive">Apenas Inativos</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-3">Produto</th>
                <th className="px-6 py-3">Lote</th>
                <th className="px-6 py-3">Validade</th>
                <th className="px-6 py-3">Quantidade</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {!isDataLoaded ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-16"></div></td>
                  </tr>
                ))
              ) : filteredItems.length > 0 ? (
                displayedItems.map(i => {
                  const isLow = i.quantity <= i.minQuantity;
                  return (
                    <tr key={i.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setEditingItem(i); setIsModalOpen(true); setActiveTab('dados'); }}>
                      <td className="px-6 py-4 font-medium flex items-center gap-2">
                         {i.name}
                         {isLow && <AlertTriangle className="w-4 h-4 text-amber-500" title="Estoque Mínimo Atingido" />}
                      </td>
                      <td className="px-6 py-4">{i.batch}</td>
                      <td className="px-6 py-4">{new Date(i.expiryDate).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4">
                        <span className={isLow ? 'text-amber-600 font-bold' : ''}>{i.quantity}</span>
                        <span className="text-gray-400 font-normal ml-1 text-xs">(Min: {i.minQuantity})</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${i.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                          {i.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhum item encontrado no estoque.</td></tr>
              )}
            </tbody>
          </table>
          {hasMore && <div ref={loadMoreRef} className="h-10 flex justify-center items-center text-gray-400 text-sm">Carregando mais...</div>}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setActiveTab('dados'); }} 
        title={editingItem ? 'Gerenciar Item' : 'Novo Item no Estoque'}
        className="max-w-2xl"
      >
        <div className="flex space-x-2 border-b border-gray-200 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition ${activeTab === 'dados' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Dados do Item
          </button>
          {editingItem && (
            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              className={`py-2 px-4 text-sm font-medium border-b-2 transition ${activeTab === 'historico' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Histórico
            </button>
          )}
        </div>

        {activeTab === 'dados' ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                <input required name="name" defaultValue={editingItem?.name} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
                <input required name="batch" defaultValue={editingItem?.batch} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Validade</label>
                <input required type="date" name="expiryDate" defaultValue={editingItem?.expiryDate} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Atual</label>
                <input required type="number" min="0" name="quantity" defaultValue={editingItem?.quantity} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Mínima (Alerta)</label>
                <input required type="number" min="0" name="minQuantity" defaultValue={editingItem?.minQuantity} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
              </div>

              {currentUserRole === 'admin' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="status" defaultValue={editingItem?.status || 'active'} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo (Descartado/Fora de uso)</option>
                  </select>
                </div>
              )}
            </div>
            
            <div className="pt-4 flex justify-between gap-3 border-t border-gray-100 pb-2">
               <div>
                  {canEdit && editingItem && (
                    <button 
                      type="button"
                      onClick={() => setWithdrawModal({isOpen: true, item: editingItem})}
                      className="px-4 py-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg font-medium transition flex items-center gap-2"
                    >
                      <MinusCircle className="w-4 h-4 inline" />
                      Registrar Nova Saída
                    </button>
                  )}
               </div>
               <div className="flex gap-2">
                 <button type="button" onClick={() => { setIsModalOpen(false); setActiveTab('dados'); }} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">
                  {canEdit ? 'Cancelar' : 'Fechar'}
                 </button>
                 {canEdit && (
                   <button type="submit" className="px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition">Salvar Item</button>
                 )}
               </div>
            </div>
          </form>
        ) : (
          editingItem && (
            <div className="mt-2">
              <div className="max-h-80 overflow-y-auto pr-2 space-y-3">
                {auditLogs.filter(log => log.entityId === editingItem.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).length > 0 ? (
                  auditLogs.filter(log => log.entityId === editingItem.id)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map(log => (
                      <div key={log.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`font-semibold ${log.action === 'UPDATE' ? 'text-blue-700' : log.action === 'STOCK_WITHDRAW' ? 'text-amber-700' : 'text-gray-700'}`}>
                            {log.action === 'STOCK_WITHDRAW' ? 'Saída de Estoque' : 'Atualização'}
                          </span>
                          <span className="text-gray-500 text-xs">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-gray-700">{log.details}</p>
                        <p className="text-gray-500 text-xs mt-1">Por: {log.userId}</p>
                      </div>
                    ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">Nenhum registro encontrado para este item.</p>
                )}
              </div>
              <div className="pt-4 flex justify-end">
                <button type="button" onClick={() => { setIsModalOpen(false); setActiveTab('dados'); }} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">
                  Fechar
                </button>
              </div>
            </div>
          )
        )}
      </Modal>

      <Modal
        isOpen={withdrawModal.isOpen}
        onClose={() => setWithdrawModal({isOpen: false, item: null})}
        title="Registrar Saída (Retirada)"
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const qtd = parseInt(fd.get('withdrawAmount') as string, 10);
          const reason = fd.get('reason') as string;
          if (withdrawModal.item && qtd > 0 && qtd <= withdrawModal.item.quantity) {
             const updatedItem = {
               ...withdrawModal.item,
               quantity: withdrawModal.item.quantity - qtd
             };
             updateInventoryItem(updatedItem);
             
             addAuditLog({
               id: Math.random().toString(36).substr(2, 9),
               action: 'Saída de Estoque',
               entityType: 'Estoque',
               entityId: withdrawModal.item.id,
               entityName: withdrawModal.item.name,
               details: `Retirada de ${qtd} unidade(s). Motivo: ${reason}`,
               userId: user?.uid || currentUserRole || 'unknown',
               timestamp: new Date().toISOString(),
               beforeData: withdrawModal.item,
               afterData: updatedItem
             });

             setWithdrawModal({isOpen: false, item: null});
          } else {
             alert('Quantidade inválida.');
          }
        }} className="space-y-4">
           {withdrawModal.item && (
             <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
               <p className="font-semibold text-gray-800">{withdrawModal.item.name}</p>
               <p className="text-sm text-gray-500">Lote: {withdrawModal.item.batch} • Em estoque: {withdrawModal.item.quantity}</p>
             </div>
           )}

           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade a retirar</label>
             <input required type="number" min="1" max={withdrawModal.item?.quantity || 1} name="withdrawAmount" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" />
           </div>

           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Vínculo Obrigatório</label>
             <textarea 
               required 
               name="reason" 
               rows={2} 
               placeholder="Ex: Receituário Paciente X (ID: 123) ou Descarte..."
               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500" 
             />
           </div>

           <div className="pt-4 flex justify-end gap-3">
             <button type="button" onClick={() => setWithdrawModal({isOpen: false, item: null})} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">
              Cancelar
             </button>
             <button type="submit" className="px-4 py-2 text-white bg-amber-600 hover:bg-amber-700 rounded-lg font-medium transition">
              Confirmar Retirada
             </button>
           </div>
        </form>
      </Modal>
    </div>
  );
}

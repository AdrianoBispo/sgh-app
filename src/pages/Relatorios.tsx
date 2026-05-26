import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Download, FileText, Filter } from 'lucide-react';
import { ReportLog } from '../types';

export function Relatorios() {
  const { reportLogs, addReportLog, currentUserRole, patients, doctors, appointments, inventory, isDataLoaded } = useAppContext();
  const [reportType, setReportType] = useState('Atendimentos');
  const [period, setPeriod] = useState('7dias');

  const canGenerate = currentUserRole === 'admin' || currentUserRole === 'reception';

  const handleGenerate = () => {
    if (!canGenerate) return;
    
    // Simulate generation
    const newLog: ReportLog = {
      id: Math.random().toString(36).substr(2, 9),
      title: `Relatório de ${reportType}`,
      type: reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUserRole === 'admin' ? 'Administrador' : 'Recepção',
      parameters: `Período: ${period}`,
    };
    
    addReportLog(newLog);
  };

  const exportToCSV = (log: ReportLog) => {
    let csvContent = "";
    let filename = "";

    if (log.type === 'Atendimentos') {
      filename = `atendimentos_${new Date().getTime()}.csv`;
      csvContent = "ID,Paciente,Médico,Data,Hora,Status,Tipo\n";
      appointments.forEach(a => {
        const pt = patients.find(p => p.id === a.patientId)?.name || 'Desconhecido';
        const doc = doctors.find(d => d.id === a.doctorId)?.name || 'Desconhecido';
        csvContent += `${a.id},"${pt}","${doc}",${a.date},${a.time},${a.status},${a.type}\n`;
      });
    } else if (log.type === 'Pacientes') {
      filename = `pacientes_${new Date().getTime()}.csv`;
      csvContent = "ID,Nome,CPF,Nascimento,Contato,Status\n";
      patients.forEach(p => {
        csvContent += `${p.id},"${p.name}","${p.cpf}",${p.birthDate},"${p.contact}",${p.status}\n`;
      });
    } else if (log.type === 'Estoque') {
      filename = `estoque_${new Date().getTime()}.csv`;
      csvContent = "ID,Nome,Lote,Validade,Quantidade,Minimo,Status\n";
      inventory.forEach(i => {
        csvContent += `${i.id},"${i.name}","${i.batch}",${i.expiryDate},${i.quantity},${i.minQuantity},${i.status}\n`;
      });
    } else {
      filename = `relatorio_${log.type}_${new Date().getTime()}.csv`;
      csvContent = "Dados agrupados não disponíveis para este tipo de relatório no momento.\n";
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // Prefix with BOM for Excel UTF-8 support
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      {canGenerate && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
            <Filter className="w-5 h-5 mr-2 text-primary-600" />
            Gerador de Relatórios
          </h2>
          <div className="flex flex-col md:flex-row gap-4 items-end">
             <div className="w-full md:w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Relatório</label>
              <select 
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="Atendimentos">Estatísticas de Atendimentos</option>
                <option value="Pacientes">Cadastros de Pacientes Ativos</option>
                <option value="Estoque">Consumo de Estoque / Posição Atual</option>
                <option value="Faturamento">Faturamento Básico</option>
              </select>
            </div>
            <div className="w-full md:w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <select 
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="Hoje">Hoje</option>
                <option value="7dias">Últimos 7 dias</option>
                <option value="30dias">Últimos 30 dias</option>
                <option value="MesAtual">Mês Atual</option>
              </select>
            </div>
            <button 
              onClick={handleGenerate}
              className="w-full md:w-auto px-6 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition"
            >
              Executar e Gerar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Relatórios Gerados Recentemente</h2>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-3">Data/Hora</th>
                <th className="px-6 py-3">Título</th>
                <th className="px-6 py-3">Parâmetros</th>
                <th className="px-6 py-3">Responsável</th>
                <th className="px-6 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {!isDataLoaded ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : reportLogs.length > 0 ? (
                [...reportLogs].reverse().map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{new Date(log.generatedAt).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 font-medium flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-gray-400" />
                      {log.title}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{log.parameters}</td>
                    <td className="px-6 py-4">{log.generatedBy}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => exportToCSV(log)}
                        className="text-primary-600 hover:text-primary-900 transition flex items-center justify-end w-full"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Baixar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhum relatório foi gerado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Activity, Download, Eye, FileText, Filter, List, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { AuditLog, ReportLog } from '../types';
import {
  REPORT_PERIODS,
  REPORT_TYPES,
  ReportPeriod,
  ReportResult,
  ReportType,
  buildReport,
  describeParameters,
  reportFileName,
} from '../lib/reports';
import { buildCSV, downloadCSV } from '../lib/csv';
import { describeError } from '../lib/firebase-errors';
import { formatDateTimeBR } from '../lib/date';
import { generateId } from '../lib/id';
import { ROLE_NAMES } from '../lib/navigation';
import { cn } from '../lib/utils';

const PREVIEW_ROWS = 8;

/** Identifica o tipo salvo no log, tolerando relatórios antigos. */
const parseReportType = (value: string): ReportType =>
  (REPORT_TYPES.find((type) => type.value === value)?.value ?? 'Atendimentos') as ReportType;

export function Relatorios() {
  const { reportLogs, auditLogs, addReportLog, currentUserRole, user, patients, doctors, appointments, inventory, isDataLoaded } =
    useAppContext();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'reports' | 'audit'>('reports');
  const [reportType, setReportType] = useState<ReportType>('Atendimentos');
  const [period, setPeriod] = useState<ReportPeriod>('7dias');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportLog | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = currentUserRole === 'admin' || currentUserRole === 'reception';
  const selectedTypeInfo = REPORT_TYPES.find((type) => type.value === reportType);

  // Os logs vinham na ordem dos IDs do Firestore e eram apenas invertidos,
  // então "gerados recentemente" não correspondia à data de geração.
  const sortedReportLogs = useMemo(
    () => [...reportLogs].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()),
    [reportLogs],
  );
  const sortedAuditLogs = useMemo(
    () => [...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [auditLogs],
  );

  const { displayedItems: displayedReports, loadMoreRef: loadMoreReportsRef, hasMore: hasMoreReports } = useInfiniteScroll(
    sortedReportLogs,
    15,
    'reports',
  );
  const { displayedItems: displayedAudits, loadMoreRef: loadMoreAuditsRef, hasMore: hasMoreAudits } = useInfiniteScroll(
    sortedAuditLogs,
    15,
    'audit',
  );

  const reportData = useMemo(
    () => ({ patients, doctors, appointments, inventory }),
    [patients, doctors, appointments, inventory],
  );

  const previewResult: ReportResult | null = useMemo(() => {
    if (!selectedReport) return null;
    const type = parseReportType(selectedReport.type);
    const storedPeriod = REPORT_PERIODS.find((item) => selectedReport.parameters.startsWith(item.label))?.value ?? period;
    return buildReport(type, storedPeriod, reportData);
  }, [selectedReport, reportData, period]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);

    const generatedAt = new Date().toISOString();
    const report: ReportLog = {
      id: generateId(),
      title: selectedTypeInfo?.label ?? `Relatório de ${reportType}`,
      type: reportType,
      generatedAt,
      generatedBy: user?.displayName || user?.email || ROLE_NAMES[currentUserRole],
      parameters: describeParameters(reportType, period),
    };

    try {
      await addReportLog(report);
      toast.success('Relatório gerado. Abra o registro para pré-visualizar e baixar.');
      setSelectedReport(report);
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível registrar o relatório.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (log: ReportLog) => {
    const type = parseReportType(log.type);
    const storedPeriod = REPORT_PERIODS.find((item) => log.parameters.startsWith(item.label))?.value ?? period;
    const result = buildReport(type, storedPeriod, reportData);

    if (result.rows.length === 0) {
      toast.warning('Não há dados para os filtros deste relatório.');
      return;
    }

    // `buildCSV` escapa aspas e separadores; a exportação anterior concatenava
    // strings e quebrava o arquivo em nomes com vírgula ou aspas.
    downloadCSV(buildCSV(result.headers, result.rows), reportFileName(type, log.generatedAt));
    toast.success(`${result.rows.length} linha(s) exportada(s).`);
  };

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="flex gap-2 border-b border-gray-200" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reports'}
          onClick={() => setActiveTab('reports')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-medium transition',
            activeTab === 'reports' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <List className="h-4 w-4" aria-hidden="true" /> Relatórios
        </button>
        {currentUserRole === 'admin' && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-medium transition',
              activeTab === 'audit' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            <Activity className="h-4 w-4" aria-hidden="true" /> Trilha de auditoria
          </button>
        )}
      </div>

      {activeTab === 'reports' ? (
        <>
          {canGenerate && (
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-6 flex items-center text-lg font-semibold text-gray-800">
                <Filter className="mr-2 h-5 w-5 text-primary-600" aria-hidden="true" />
                Gerador de relatórios
              </h2>
              <div className="flex flex-col items-end gap-4 md:flex-row">
                <div className="w-full md:w-1/3">
                  <label htmlFor="report-type" className="mb-1 block text-sm font-medium text-gray-700">Tipo de relatório</label>
                  <select
                    id="report-type"
                    value={reportType}
                    onChange={(event) => setReportType(event.target.value as ReportType)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    {REPORT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{selectedTypeInfo?.description}</p>
                </div>

                <div className="w-full md:w-1/3">
                  <label htmlFor="report-period" className="mb-1 block text-sm font-medium text-gray-700">Período</label>
                  <select
                    id="report-period"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
                    disabled={!selectedTypeInfo?.periodAware}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {REPORT_PERIODS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{describeParameters(reportType, period)}</p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-60 md:w-auto"
                >
                  {isGenerating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {isGenerating ? 'Gerando...' : 'Executar e gerar'}
                </button>
              </div>
            </section>
          )}

          <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800">Relatórios gerados recentemente</h2>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="bg-gray-50 font-medium text-gray-600">
                  <tr>
                    <th scope="col" className="px-6 py-3">Data/hora</th>
                    <th scope="col" className="px-6 py-3">Título</th>
                    <th scope="col" className="px-6 py-3">Parâmetros</th>
                    <th scope="col" className="px-6 py-3">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-800">
                  {!isDataLoaded ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        {Array.from({ length: 4 }).map((__, cell) => (
                          <td key={cell} className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                        ))}
                      </tr>
                    ))
                  ) : displayedReports.length > 0 ? (
                    displayedReports.map((log) => (
                      <tr key={log.id} className="transition hover:bg-gray-50">
                        <td className="px-6 py-4">{formatDateTimeBR(log.generatedAt)}</td>
                        <td className="px-6 py-4 font-medium">
                          <button
                            type="button"
                            onClick={() => setSelectedReport(log)}
                            className="flex items-center rounded transition hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          >
                            <FileText className="mr-2 h-4 w-4 text-gray-400" aria-hidden="true" />
                            {log.title}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{log.parameters}</td>
                        <td className="px-6 py-4">{log.generatedBy}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-500">Nenhum relatório foi gerado ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {hasMoreReports && (
                <div ref={loadMoreReportsRef} className="flex h-10 items-center justify-center text-sm text-gray-400">
                  Carregando mais...
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800">Trilha de auditoria (ações críticas)</h2>
            <p className="mt-1 text-sm text-gray-500">Exclusões lógicas, edições sensíveis e movimentações de estoque.</p>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-gray-50 font-medium text-gray-600">
                <tr>
                  <th scope="col" className="px-6 py-3">Data/hora</th>
                  <th scope="col" className="px-6 py-3">Ação</th>
                  <th scope="col" className="px-6 py-3">Entidade</th>
                  <th scope="col" className="px-6 py-3">Referência</th>
                  <th scope="col" className="px-6 py-3">Detalhes</th>
                  <th scope="col" className="px-6 py-3">Autor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {!isDataLoaded ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      {Array.from({ length: 6 }).map((__, cell) => (
                        <td key={cell} className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                      ))}
                    </tr>
                  ))
                ) : displayedAudits.length > 0 ? (
                  displayedAudits.map((log) => (
                    <tr key={log.id} className="transition hover:bg-gray-50">
                      <td className="px-6 py-4">{formatDateTimeBR(log.timestamp)}</td>
                      <td className="px-6 py-4 font-medium">
                        <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold">{log.action}</span>
                      </td>
                      <td className="px-6 py-4">{log.entityType}</td>
                      <td className="px-6 py-4">{log.entityName}</td>
                      <td className="min-w-[200px] whitespace-normal px-6 py-4 text-gray-500">
                        <button
                          type="button"
                          onClick={() => setSelectedAuditLog(log)}
                          className="flex items-center gap-2 rounded text-left transition hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          title="Ver detalhes da alteração"
                        >
                          <span className="inline-block max-w-[220px] truncate">{log.details}</span>
                          <Eye className="h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                        </button>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">{log.userId}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Nenhum evento de auditoria registrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {hasMoreAudits && (
              <div ref={loadMoreAuditsRef} className="flex h-10 items-center justify-center text-sm text-gray-400">
                Carregando mais...
              </div>
            )}
          </div>
        </section>
      )}

      <Modal
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title="Detalhes do relatório"
        description={selectedReport?.parameters}
        className="max-w-3xl"
      >
        {selectedReport && previewResult && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
              <FileText className="h-8 w-8 text-primary-600" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-gray-900">{selectedReport.title}</h3>
                <p className="text-sm text-gray-500">
                  Gerado por {selectedReport.generatedBy} em {formatDateTimeBR(selectedReport.generatedAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previewResult.highlights.map((highlight) => (
                <div key={highlight.label} className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{highlight.label}</p>
                  <p className="mt-1 font-semibold text-gray-900">{highlight.value}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-800">
                Prévia ({Math.min(PREVIEW_ROWS, previewResult.rows.length)} de {previewResult.rows.length} linha(s))
              </h4>
              <div className="max-h-72 overflow-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-600">
                    <tr>
                      {previewResult.headers.map((header) => (
                        <th key={header} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewResult.rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="whitespace-nowrap px-3 py-2 text-gray-700">{String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                    {previewResult.rows.length === 0 && (
                      <tr>
                        <td colSpan={previewResult.headers.length} className="px-3 py-6 text-center text-gray-500">
                          Nenhum dado para os filtros deste relatório.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleDownload(selectedReport)}
                disabled={previewResult.rows.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-50 sm:w-auto"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
                Baixar CSV
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(selectedAuditLog)} onClose={() => setSelectedAuditLog(null)} title="Detalhes da auditoria" className="max-w-2xl">
        {selectedAuditLog && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{selectedAuditLog.action}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedAuditLog.entityType}: {selectedAuditLog.entityName}
                  </p>
                </div>
                <span className="rounded border border-gray-100 bg-white px-2 py-1 font-mono text-xs text-gray-400">
                  {formatDateTimeBR(selectedAuditLog.timestamp)}
                </span>
              </div>
              <p className="mt-2 rounded-lg border border-gray-100 bg-white p-3 text-sm text-gray-700">{selectedAuditLog.details}</p>
            </div>

            {Boolean(selectedAuditLog.beforeData || selectedAuditLog.afterData) && (
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-800">
                  <Activity className="h-4 w-4" aria-hidden="true" />
                  Alterações nos campos
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(
                    [
                      { label: 'Antes', data: selectedAuditLog.beforeData, tone: 'red' },
                      { label: 'Depois', data: selectedAuditLog.afterData, tone: 'emerald' },
                    ] as const
                  ).map(({ label, data, tone }) => (
                    <div key={label} className={cn('overflow-hidden rounded-xl border', tone === 'red' ? 'border-red-100 bg-red-50/50' : 'border-emerald-100 bg-emerald-50/50')}>
                      <div className={cn('px-3 py-2 text-xs font-semibold uppercase', tone === 'red' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800')}>
                        {label}
                      </div>
                      <div className="p-3">
                        {data ? (
                          <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700">{JSON.stringify(data, null, 2)}</pre>
                        ) : (
                          <span className="text-xs italic text-gray-400">Sem dados registrados</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

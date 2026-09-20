import { ChangeEvent, useRef, useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import { ExportableRow, SPREADSHEET_ACCEPT, SpreadsheetRow, exportToCSV, exportToXLSX, importFromSpreadsheet } from '../../lib/spreadsheet';
import { useToast } from './Toast';

interface ImportExportProps {
  onImport: (rows: SpreadsheetRow[]) => void | Promise<void>;
  exportData: ExportableRow[];
  exportFileName: string;
  /** Oculta a importação para perfis somente leitura. */
  canImport?: boolean;
}

export function ImportExportButtons({ onImport, exportData, exportFileName, canImport = true }: ImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const toast = useToast();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite reimportar o mesmo arquivo
    if (!file) return;

    setIsImporting(true);
    try {
      const rows = await importFromSpreadsheet(file);
      if (rows.length === 0) {
        toast.warning('A planilha está vazia.');
        return;
      }
      await onImport(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ler o arquivo. Use XLSX ou CSV.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (exportData.length === 0) {
      toast.warning('Não há dados para exportar.');
      return;
    }
    try {
      if (format === 'xlsx') await exportToXLSX(exportData, exportFileName);
      else await exportToCSV(exportData, exportFileName);
      toast.success(`${exportData.length} registro(s) exportado(s) em ${format.toUpperCase()}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao gerar o arquivo de exportação.');
    }
  };

  return (
    <div className="flex items-center gap-2">
      {canImport && (
        <>
          <input type="file" accept={SPREADSHEET_ACCEPT} ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
            title="Importar planilha (XLSX ou CSV)"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{isImporting ? 'Importando...' : 'Importar'}</span>
          </button>
        </>
      )}

      <div className="flex overflow-hidden rounded-lg border border-gray-300 shadow-sm">
        <button
          type="button"
          onClick={() => void handleExport('xlsx')}
          className="flex items-center gap-2 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          title="Exportar em XLSX"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">XLSX</span>
        </button>
        <button
          type="button"
          onClick={() => void handleExport('csv')}
          className="border-l border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          title="Exportar em CSV"
        >
          CSV
        </button>
      </div>
    </div>
  );
}

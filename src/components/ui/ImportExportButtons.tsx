import React, { useRef } from 'react';
import { Upload, Download } from 'lucide-react';
import { importFromSpreadsheet, exportToXLSX, exportToCSV } from '../../lib/spreadsheet';

interface ImportExportProps {
  onImport: (data: any[]) => void;
  exportData: any[];
  exportFileName: string;
}

export function ImportExportButtons({ onImport, exportData, exportFileName }: ImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await importFromSpreadsheet(file);
        onImport(data);
      } catch (error) {
        console.error("Failed to parse file", error);
        alert("Erro ao ler arquivo. Verifique se o formato está correto (XLSX ou CSV).");
      }
      e.target.value = ''; // reset
    }
  };

  const handleExportMenu = (format: 'xlsx' | 'csv') => {
    if (format === 'xlsx') {
      exportToXLSX(exportData, exportFileName);
    } else {
      exportToCSV(exportData, exportFileName);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input 
        type="file" 
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <button 
        onClick={handleImportClick}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium shadow-sm"
        title="Importar de Planilha (XLSX, CSV)"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Importar</span>
      </button>

      <div className="relative group">
        <button 
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar</span>
        </button>
        <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
          <button 
            onClick={() => handleExportMenu('xlsx')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg"
          >
            Exportar XLSX
          </button>
          <button 
            onClick={() => handleExportMenu('csv')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 last:rounded-b-lg"
          >
            Exportar CSV
          </button>
        </div>
      </div>
    </div>
  );
}

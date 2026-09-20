import { downloadCSV, downloadFile } from './csv';

/** `xlsx` pesa centenas de kB e só é usado em importação/exportação. */
const loadXLSX = () => import('xlsx');

/** Extensões aceitas na importação. */
export const SPREADSHEET_ACCEPT =
  '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

/** Limite de tamanho do arquivo importado (5 MB). */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type SpreadsheetRow = Record<string, unknown>;

/** Qualquer entidade do domínio pode ser exportada como linha de planilha. */
export type ExportableRow = object;

export const exportToXLSX = async (data: ExportableRow[], fileName: string): Promise<void> => {
  const XLSX = await loadXLSX();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  downloadFile(buffer, `${fileName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

export const exportToCSV = async (data: ExportableRow[], fileName: string): Promise<void> => {
  const XLSX = await loadXLSX();
  const worksheet = XLSX.utils.json_to_sheet(data);
  downloadCSV(XLSX.utils.sheet_to_csv(worksheet), `${fileName}.csv`);
};

/**
 * Lê uma planilha e devolve as linhas como objetos.
 * Usa `ArrayBuffer` em vez do obsoleto `readAsBinaryString`, valida o tamanho
 * e normaliza os cabeçalhos (`Nome ` e `nome` viram a mesma chave).
 */
export const importFromSpreadsheet = (file: File): Promise<SpreadsheetRow[]> =>
  new Promise((resolve, reject) => {
    if (file.size > MAX_IMPORT_BYTES) {
      reject(new Error('O arquivo excede o limite de 5 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await loadXLSX();
        const workbook = XLSX.read(event.target?.result, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('A planilha não possui nenhuma aba com dados.'));
          return;
        }
        const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(workbook.Sheets[firstSheetName], { defval: '' });
        resolve(rows.map(normalizeKeys));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Falha ao interpretar a planilha.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsArrayBuffer(file);
  });

function normalizeKeys(row: SpreadsheetRow): SpreadsheetRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim(), value]));
}

/** Lê um campo aceitando variações de caixa e acentuação do cabeçalho. */
export function readField(row: SpreadsheetRow, ...names: string[]): string {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const wanted = names.map(normalize);
  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(normalize(key))) return String(value ?? '').trim();
  }
  return '';
}

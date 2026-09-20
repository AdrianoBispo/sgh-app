/** Escapa um valor para CSV (RFC 4180): aspas duplicadas e campo citado. */
export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",;\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Monta um CSV a partir de cabeçalhos e linhas já ordenadas. */
export function buildCSV(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\r\n') + '\r\n';
}

/**
 * Dispara o download de um arquivo no navegador, liberando o object URL
 * em seguida (o código anterior vazava um blob por exportação).
 */
export function downloadFile(content: BlobPart, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoga no próximo tick para não cancelar o download em andamento.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Baixa um CSV com BOM UTF-8 (necessário para acentuação no Excel). */
export function downloadCSV(content: string, fileName: string): void {
  downloadFile('﻿' + content, fileName, 'text/csv;charset=utf-8;');
}

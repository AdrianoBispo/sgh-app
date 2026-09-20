import { describe, it, expect } from 'vitest';
import { buildCSV, escapeCSV } from './csv';

describe('escapeCSV', () => {
  it('cita campos com separadores e quebras de linha', () => {
    expect(escapeCSV('Silva, João')).toBe('"Silva, João"');
    expect(escapeCSV('linha1\nlinha2')).toBe('"linha1\nlinha2"');
    expect(escapeCSV('a;b')).toBe('"a;b"');
  });

  it('duplica aspas internas', () => {
    // Regressão: a exportação anterior só envolvia o valor em aspas e um nome
    // como este quebrava as colunas do arquivo.
    expect(escapeCSV('Paciente "Zé"')).toBe('"Paciente ""Zé"""');
  });

  it('mantém valores simples e trata nulos', () => {
    expect(escapeCSV('Ana')).toBe('Ana');
    expect(escapeCSV(42)).toBe('42');
    expect(escapeCSV(null)).toBe('');
    expect(escapeCSV(undefined)).toBe('');
  });
});

describe('buildCSV', () => {
  it('monta cabeçalho e linhas com CRLF', () => {
    const csv = buildCSV(['Nome', 'Obs'], [['Ana', 'ok'], ['Silva, João', 'diz "oi"']]);
    expect(csv).toBe('Nome,Obs\r\nAna,ok\r\n"Silva, João","diz ""oi"""\r\n');
  });
});

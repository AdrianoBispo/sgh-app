import type { jsPDF } from 'jspdf';
import { Appointment, Doctor, Patient } from '../types';
import { ageFromBirthDate, formatDateBR } from './date';
import { APP_NAME, CLINIC_NAME } from './navigation';

export const DOCUMENT_TYPES = ['Comprovante', 'Atestado', 'Receituário', 'Encaminhamento'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * `jspdf` e `jspdf-autotable` somam centenas de kB e só são necessários quando
 * alguém emite um documento — por isso entram por import dinâmico, fora do
 * bundle inicial.
 */
async function loadPdfLibs() {
  const [{ jsPDF }, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable: autoTable.default };
}

const PRIMARY: [number, number, number] = [14, 165, 233];
const PAGE_WIDTH = 210;
const MARGIN = 14;
const CENTER = PAGE_WIDTH / 2;

/** Nome de arquivo seguro (sem acentos nem separadores de caminho). */
const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'documento';

function header(doc: jsPDF, title: string, subtitle?: string): void {
  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY);
  doc.text(CLINIC_NAME, CENTER, 18, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`${APP_NAME} · Sistema de gestão clínica`, CENTER, 24, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(title.toUpperCase(), CENTER, 34, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitle, CENTER, 40, { align: 'center' });
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, 44, PAGE_WIDTH - MARGIN, 44);
  doc.setTextColor(0, 0, 0);
}

function footer(doc: jsPDF, withSignature: boolean): void {
  if (withSignature) {
    doc.setDrawColor(0, 0, 0);
    doc.line(65, 232, 145, 232);
    doc.setFontSize(10);
    doc.text('Assinatura e carimbo do profissional', CENTER, 238, { align: 'center' });
  }
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`Emitido por ${APP_NAME} em ${new Date().toLocaleString('pt-BR')}`, CENTER, 285, { align: 'center' });
}

/**
 * Quebra o texto na largura útil da página. Antes as frases eram posicionadas
 * com coordenadas fixas e nomes longos vazavam para fora da margem.
 */
function paragraph(doc: jsPDF, text: string, y: number, lineHeight = 7): number {
  const lines = doc.splitTextToSize(text, PAGE_WIDTH - MARGIN * 2);
  doc.text(lines, MARGIN, y);
  return y + lines.length * lineHeight;
}

export const generatePatientSummaryPDF = async (patient: Patient, appointments: Appointment[], doctors: Doctor[]): Promise<void> => {
  try {
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF();
    header(doc, 'Resumo do paciente');

    const age = ageFromBirthDate(patient.birthDate);
    doc.setFontSize(11);
    let cursor = 54;
    cursor = paragraph(doc, `Nome: ${patient.name}`, cursor);
    cursor = paragraph(doc, `CPF: ${patient.cpf}`, cursor);
    cursor = paragraph(doc, `Nascimento: ${formatDateBR(patient.birthDate)}${age !== null ? ` (${age} anos)` : ''}`, cursor);
    cursor = paragraph(doc, `Contato: ${patient.contact || 'Não informado'}`, cursor);
    cursor = paragraph(doc, `Tipo sanguíneo: ${patient.bloodType || 'Não informado'}`, cursor);
    cursor = paragraph(doc, `Situação do cadastro: ${patient.status === 'active' ? 'Ativo' : 'Inativo'}`, cursor);

    cursor += 6;
    doc.setFontSize(13);
    doc.text('Informações clínicas', MARGIN, cursor);
    cursor += 8;
    doc.setFontSize(10);
    cursor = paragraph(doc, patient.description || 'Nenhuma observação registrada.', cursor, 6);

    cursor += 8;
    doc.setFontSize(13);
    doc.text('Histórico de consultas e exames', MARGIN, cursor);

    autoTable(doc, {
      startY: cursor + 5,
      head: [['Data', 'Hora', 'Tipo', 'Profissional', 'Status', 'CID-10']],
      body: appointments.map((appointment) => [
        formatDateBR(appointment.date),
        appointment.time,
        appointment.type,
        doctors.find((doctor) => doctor.id === appointment.doctorId)?.name || 'Não identificado',
        appointment.status,
        appointment.cid10 || '-',
      ]),
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: PRIMARY },
    });

    footer(doc, false);
    doc.save(`resumo_paciente_${slugify(patient.name)}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar resumo do paciente:', error);
    throw new Error('Não foi possível gerar o PDF do resumo.');
  }
};

export const generateDocumentPDF = async (
  patient: Patient,
  appointment: Appointment,
  doctor: Doctor | undefined,
  docType: DocumentType,
): Promise<void> => {
  try {
    const { jsPDF } = await loadPdfLibs();
    const doc = new jsPDF();
    header(doc, docType, `Atendimento de ${formatDateBR(appointment.date)} às ${appointment.time}`);

    doc.setFontSize(11);
    let cursor = 54;
    cursor = paragraph(doc, `Paciente: ${patient.name}`, cursor);
    cursor = paragraph(doc, `CPF: ${patient.cpf}`, cursor);
    cursor = paragraph(doc, `Profissional: ${doctor?.name || 'Não identificado'}${doctor?.crm ? ` — CRM ${doctor.crm}` : ''}`, cursor);
    if (doctor?.specialty) cursor = paragraph(doc, `Especialidade: ${doctor.specialty}`, cursor);

    cursor += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(MARGIN, cursor, PAGE_WIDTH - MARGIN, cursor);
    cursor += 10;

    const cid = appointment.cid10 ? appointment.cid10.toUpperCase() : '__________';

    if (docType === 'Comprovante') {
      cursor = paragraph(doc, `Tipo de atendimento: ${appointment.type}`, cursor);
      cursor = paragraph(doc, `Data e hora: ${formatDateBR(appointment.date)} às ${appointment.time}`, cursor);
      cursor = paragraph(doc, `Situação: ${appointment.status}`, cursor);
      if (appointment.notes) cursor = paragraph(doc, `Observações: ${appointment.notes}`, cursor);
    } else if (docType === 'Atestado') {
      cursor = paragraph(
        doc,
        `Atesto, para os devidos fins, que o(a) paciente ${patient.name}, portador(a) do CPF ${patient.cpf}, ` +
          `esteve sob meus cuidados profissionais no dia ${formatDateBR(appointment.date)}, às ${appointment.time}.`,
        cursor,
      );
      cursor += 4;
      cursor = paragraph(doc, `Deve afastar-se de suas atividades por ______ dia(s) a partir desta data.`, cursor);
      cursor = paragraph(doc, `CID-10: ${cid}`, cursor);
    } else if (docType === 'Receituário') {
      cursor = paragraph(doc, 'Prescrição:', cursor);
      cursor += 4;
      for (let line = 1; line <= 6; line++) {
        doc.text(`${line}. ${'_'.repeat(70)}`, MARGIN, cursor);
        cursor += 12;
      }
    } else {
      cursor = paragraph(doc, 'Ao(À) colega especialista,', cursor);
      cursor += 2;
      cursor = paragraph(doc, `Encaminho o(a) paciente ${patient.name} para avaliação e conduta especializada.`, cursor);
      cursor = paragraph(doc, `Hipótese diagnóstica (CID-10): ${cid}`, cursor);
      cursor += 4;
      for (let line = 0; line < 3; line++) {
        doc.text('_'.repeat(75), MARGIN, cursor);
        cursor += 12;
      }
    }

    footer(doc, docType !== 'Comprovante');
    doc.save(`${slugify(docType)}_${slugify(patient.name)}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar documento:', error);
    throw new Error('Não foi possível gerar o PDF do documento.');
  }
};

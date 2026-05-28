import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, Appointment, Doctor } from '../types';

export const generatePatientSummaryPDF = (patient: Patient, appointments: Appointment[], docs: Doctor[]) => {
  try {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(14, 165, 233); // Primary color
    doc.text('Resumo do Paciente', 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(55, 65, 81); // gray-700
    doc.text(`Nome: ${patient.name}`, 14, 30);
    doc.text(`CPF: ${patient.cpf}`, 14, 38);
    doc.text(`Data de Nasc.: ${new Date(patient.birthDate).toLocaleDateString('pt-BR')}`, 14, 46);
    doc.text(`Contato: ${patient.contact}`, 14, 54);
    if (patient.bloodType) doc.text(`Tipo Sanguíneo: ${patient.bloodType}`, 14, 62);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Informações Clínicas', 14, 78);
    
    doc.setFontSize(10);
    doc.text(`Descrição / Observações: ${patient.description || 'Nenhuma registrada'}`, 14, 86);

    doc.setFontSize(14);
    doc.text('Histórico de Consultas e Exames', 14, 110);

    const tableData = appointments.map(a => {
      const doctor = docs.find(d => d.id === a.doctorId);
      return [
        new Date(`${a.date}T12:00:00`).toLocaleDateString('pt-BR'),
        a.time,
        a.type,
        doctor?.name || 'Desconhecido',
        a.status
      ];
    });

    autoTable(doc, {
      startY: 115,
      head: [['Data', 'Hora', 'Tipo', 'Médico', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233] },
    });

    doc.save(`resumo_paciente_${patient.name.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Error generating summary:', error);
    alert('Erro ao gerar resumo: ' + (error as Error).message);
  }
};

export const generateDocumentPDF = (
  patient: Patient,
  appointment: Appointment,
  doctor: Doctor | undefined,
  docType: 'Comprovante' | 'Atestado' | 'Receituário' | 'Encaminhamento'
) => {
  try {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(14, 165, 233);
    doc.text('Clínica Sereno', 105, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(docType.toUpperCase(), 105, 35, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Paciente: ${patient.name}`, 14, 50);
    doc.text(`CPF: ${patient.cpf}`, 14, 58);
    doc.text(`Médico: ${doctor?.name || 'Desconhecido'}`, 14, 66);
    if (doctor?.crm) doc.text(`CRM: ${doctor.crm}`, 14, 74);
    
    doc.text(`Data do Atendimento: ${new Date(`${appointment.date}T12:00:00`).toLocaleDateString('pt-BR')}`, 14, 82);

    doc.setLineWidth(0.5);
    doc.line(14, 90, 196, 90);

    doc.setFontSize(12);
    
    let currentY = 100;
    
    if (docType === 'Comprovante') {
      doc.text(`COMPROVANTE DE AGENDAMENTO`, 14, currentY);
      doc.text(`Tipo: ${appointment.type}`, 14, currentY + 10);
      doc.text(`Status: ${appointment.status}`, 14, currentY + 20);
      doc.text(`Data: ${new Date(`${appointment.date}T12:00:00`).toLocaleDateString('pt-BR')} às ${appointment.time}`, 14, currentY + 30);
    } else if (docType === 'Atestado') {
      doc.text(`Atesto, para os devidos fins, que o(a) paciente ${patient.name}, portador(a)`, 14, currentY);
      doc.text(`do CPF ${patient.cpf}, esteve sob meus cuidados médicos no dia`, 14, currentY + 8);
      doc.text(`${new Date(`${appointment.date}T12:00:00`).toLocaleDateString('pt-BR')}, devendo afastar-se de suas atividades laborais por`, 14, currentY + 16);
      doc.text(`___ dias a partir desta data, por motivo de saúde (CID: ______ ).`, 14, currentY + 24);
    } else if (docType === 'Receituário') {
      doc.text(`Prescrição Médica:`, 14, currentY);
      doc.text(`Uso Interno/Externo`, 14, currentY + 10);
      doc.line(14, currentY + 15, 196, currentY + 15);
      // blank lines for manual filling or mock text
      doc.text(`1. ______________________________________________________________`, 14, currentY + 30);
      doc.text(`2. ______________________________________________________________`, 14, currentY + 45);
      doc.text(`3. ______________________________________________________________`, 14, currentY + 60);
    } else if (docType === 'Encaminhamento') {
      doc.text(`Ao Colega Especialista,`, 14, currentY);
      doc.text(`Encaminho o(a) paciente ${patient.name} para avaliação e conduta`, 14, currentY + 10);
      doc.text(`especializada.`, 14, currentY + 18);
      doc.text(`Motivo: _________________________________________________________`, 14, currentY + 34);
      doc.text(`_________________________________________________________________`, 14, currentY + 44);
    }

    // Footer / Signature
    doc.line(65, 230, 145, 230);
    doc.setFontSize(10);
    doc.text(`Assinatura e Carimbo do Médico`, 105, 235, { align: 'center' });
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 280, { align: 'center' });

    doc.save(`${docType.toLowerCase()}_${patient.name.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Error generating document:', error);
    alert('Erro ao gerar documento: ' + (error as Error).message);
  }
};

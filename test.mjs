import { jsPDF } from 'jspdf';

try {
  const doc = new jsPDF();
  doc.text("Hello", 10, 10);
  console.log("PDF generated successfully");
} catch(e) {
  console.error("PDF FAILED:", e);
}

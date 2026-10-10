// Export ke Format CSV (Excel)
function exportToCSV() {
  if (!allActivities || allActivities.length === 0) {
    showToast("Tidak ada data untuk diexport!", "error");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Waktu & Tanggal,Nama Aktivitas,Kategori,Durasi (Menit),Catatan\n";

  allActivities.forEach(item => {
    const dateTimeFormatted = `"${item.dateTime.replace('T', ' ')}"`;
    const titleEscaped = `"${item.title.replace(/"/g, '""')}"`;
    const categoryEscaped = `"${item.category}"`;
    const durationEscaped = item.duration;
    const notesEscaped = `"${(item.notes || '').replace(/"/g, '""')}"`;

    csvContent += `${dateTimeFormatted},${titleEscaped},${categoryEscaped},${durationEscaped},${notesEscaped}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Laporan_Aktivitas_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("File CSV berhasil diunduh!", "success");
}

// Export ke Format PDF Dokumen
function exportToPDF() {
  if (!allActivities || allActivities.length === 0) {
    showToast("Tidak ada data untuk diexport!", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const userEmail = currentUser ? currentUser.email : "User";
  
  // Header PDF
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text("Laporan Aktivitas Harian", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Email Akun: ${userEmail}`, 14, 28);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 34);

  // Data Tabel
  const tableRows = [];
  allActivities.forEach(item => {
    const dateObj = new Date(item.dateTime);
    const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    tableRows.push([
      dateStr,
      item.title,
      item.category,
      `${item.duration} Menit`,
      item.notes || '-'
    ]);
  });

  doc.autoTable({
    startY: 40,
    head: [['Waktu', 'Aktivitas', 'Kategori', 'Durasi', 'Catatan']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 }
  });

  doc.save(`Laporan_Aktivitas_${new Date().toISOString().split('T')[0]}.pdf`);
  showToast("File PDF berhasil diunduh!", "success");
}

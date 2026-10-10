// =============================================================
// MODUL IMPORT DATA (CSV & PDF)
// =============================================================

// Trigger Input File
function triggerFileInput() {
  document.getElementById('importFileInput').click();
}

// Handler Utama Saat File Dipilih
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileType = file.name.split('.').pop().toLowerCase();

  try {
    showToast("Membaca file...", "info");

    if (fileType === 'csv') {
      parseCSVFile(file);
    } else if (fileType === 'pdf') {
      await parsePDFFile(file);
    } else {
      showToast("Format file tidak didukung! Gunakan CSV atau PDF.", "error");
    }
  } catch (err) {
    console.error("Import Error:", err);
    showToast("Gagal membaca isi file.", "error");
  } finally {
    event.target.value = ''; // Reset input
  }
}

// 1. PARSING FILE CSV
function parseCSVFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.data && results.data.length > 0) {
        processAndSaveEntries(results.data);
      } else {
        showToast("File CSV kosong atau format tidak sesuai.", "error");
      }
    },
    error: function (err) {
      console.error("CSV Parse Error:", err);
      showToast("Format CSV tidak valid.", "error");
    }
  });
}

// 2. PARSING FILE PDF
async function parsePDFFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  
  // Set Worker untuk PDF.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullTextLines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageLines = textContent.items.map(item => item.str.trim()).filter(text => text.length > 0);
    fullTextLines = fullTextLines.concat(pageLines);
  }

  // Ekstrak baris data dari teks PDF
  const parsedActivities = extractActivitiesFromPDFText(fullTextLines);
  
  if (parsedActivities.length > 0) {
    processAndSaveEntries(parsedActivities);
  } else {
    showToast("Teks PDF tidak dapat dibaca atau format tidak sesuai.", "error");
  }
}

// Ekstraksi Baris Teks PDF ke Objek Aktivitas
function extractActivitiesFromPDFText(lines) {
  const activities = [];
  const validCategories = ['Olahraga', 'Belajar', 'Pekerjaan', 'Hiburan', 'Istirahat', 'Lainnya'];

  lines.forEach(line => {
    // Mencari pola kategori di dalam baris
    validCategories.forEach(cat => {
      if (line.includes(cat)) {
        const parts = line.split(cat);
        const title = parts[0].trim() || "Aktivitas Import PDF";
        
        // Cari angka durasi (menit)
        const durationMatch = line.match(/(\d+)\s*Min/i) || line.match(/(\d+)\s*Menit/i);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 30;

        activities.push({
          'Nama Aktivitas': title,
          'Kategori': cat,
          'Durasi (Menit)': duration,
          'Waktu & Tanggal': new Date().toISOString().slice(0, 16),
          'Catatan': 'Imported from PDF'
        });
      }
    });
  });

  return activities;
}

// 3. SIMPAN KUMPULAN DATA KE FIREBASE
async function processAndSaveEntries(rawItems) {
  if (!userActivitiesRef) {
    showToast("Silakan login terlebih dahulu.", "error");
    return;
  }

  let successCount = 0;
  const validCategories = ['Olahraga', 'Belajar', 'Pekerjaan', 'Hiburan', 'Istirahat', 'Lainnya'];

  showToast(`Mengunggah ${rawItems.length} data ke Cloud...`, "info");

  for (const item of rawItems) {
    // Pemetaan nama kolom fleksibel (CSV/PDF)
    const title = item['Nama Aktivitas'] || item['Aktivitas'] || item['title'] || item['Title'];
    let category = item['Kategori'] || item['category'] || 'Lainnya';
    const duration = parseInt(item['Durasi (Menit)'] || item['Durasi'] || item['duration'] || 30);
    let dateTime = item['Waktu & Tanggal'] || item['Waktu'] || item['dateTime'] || new Date().toISOString().slice(0, 16);
    const notes = item['Catatan'] || item['notes'] || '';

    if (!title) continue; // Lewati jika tidak ada nama aktivitas

    // Normalisasi Nama Kategori
    category = validCategories.find(c => c.toLowerCase() === category.toLowerCase()) || 'Lainnya';

    // Format Ulang Waktu ke datetime-local jika perlu
    if (dateTime.includes(' ')) {
      dateTime = dateTime.replace(' ', 'T');
    }

    const newActivity = {
      title,
      category,
      duration: isNaN(duration) ? 30 : duration,
      dateTime,
      notes,
      createdAt: new Date().toISOString()
    };

    try {
      await userActivitiesRef.push(newActivity);
      successCount++;
    } catch (err) {
      console.error("Batch insert item error:", err);
    }
  }

  if (successCount > 0) {
    showToast(`Berhasil mengimpor ${successCount} aktivitas!`, "success");
  } else {
    showToast("Tidak ada data valid yang tersimpan.", "error");
  }
}

// Download File Template CSV untuk Panduan Format
function downloadCSVTemplate() {
  const templateCSV = "data:text/csv;charset=utf-8,Waktu & Tanggal,Nama Aktivitas,Kategori,Durasi (Menit),Catatan\n2026-10-10T08:00,Lari Pagi,Olahraga,45,Lari di Stadion\n2026-10-10T10:00,Belajar Firebase,Belajar,60,Modul Import Data";
  
  const encodedUri = encodeURI(templateCSV);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Template_Import_Aktivitas.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("Template CSV diunduh!", "success");
}

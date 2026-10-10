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

  // FITUR KEAMANAN: Batasan ukuran file maksimal 500 MB (dalam bytes)
  const maxSizeBytes = 500 * 1024 * 1024; 
  
  if (file.size > maxSizeBytes) {
    showToast("Upload ditolak: Ukuran file melebihi batas 500MB!", "error");
    event.target.value = ''; // Reset input agar user bisa memilih file lain
    return; // Hentikan eksekusi skrip di sini
  }

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
    event.target.value = ''; // Reset input setelah selesai
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
  if (!userActivitiesRef) return;

  showToast("Menyiapkan data...", "info");

  const updates = {};
  const validCategories = ['Olahraga', 'Belajar', 'Pekerjaan', 'Hiburan', 'Istirahat', 'Lainnya'];

  // Kumpulkan semua data ke dalam satu objek
  rawItems.forEach(item => {
    const title = item['Nama Aktivitas'] || item['Aktivitas'] || item['title'];
    if (!title) return;

    let category = item['Kategori'] || item['category'] || 'Lainnya';
    category = validCategories.find(c => c.toLowerCase() === category.toLowerCase()) || 'Lainnya';

    const duration = parseInt(item['Durasi (Menit)'] || item['duration'] || 30);
    let dateTime = item['Waktu & Tanggal'] || item['dateTime'] || new Date().toISOString().slice(0, 16);
    if (dateTime.includes(' ')) dateTime = dateTime.replace(' ', 'T');

    // Buat ID unik Firebase tanpa mengirim request dulu
    const newKey = userActivitiesRef.push().key;
    updates[newKey] = {
      title,
      category,
      duration: isNaN(duration) ? 30 : duration,
      dateTime,
      notes: item['Catatan'] || item['notes'] || '',
      createdAt: new Date().toISOString()
    };
  });

  try {
    showToast("Mengunggah data sekaligus ke Cloud...", "info");
    // Kirim ribuan data dalam 1 kali request jaringan!
    await userActivitiesRef.update(updates);
    showToast("Berhasil mengimpor semua data!", "success");
  } catch (err) {
    console.error("Batch update error:", err);
    showToast("Gagal mengunggah data (ukuran file terlalu besar untuk 1 request)", "error");
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

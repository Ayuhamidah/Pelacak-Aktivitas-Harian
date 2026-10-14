// =============================================================
// MODUL DASHBOARD, GRAFIK & PAGINASI (app.js)
// =============================================================

// Default Datetime Local Input
window.USER_TIER = localStorage.getItem('userTier') || 'free';
let forecastChartInstance = null;
const now = new Date();

now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
const inputDateEl = document.getElementById('inputDateTime');
if (inputDateEl) inputDateEl.value = now.toISOString().slice(0, 16);

// Realtime Firebase Listener
function listenToUserActivities() {
if (!userActivitiesRef) {
    console.warn("Reference ke database belum siap.");
    return;
  }

  // Aktifkan listener untuk membaca data secara real-time
  userActivitiesRef.on('value', (snapshot) => {
    const data = snapshot.val();
    
    // Perbarui UI Dashboard dan Grafik dengan data terbaru
    if (typeof updateDashboard === "function") updateDashboard(data);
    if (typeof renderCharts === "function") renderCharts(data);
    
    // Cek batas tier (Free/Premium) setiap kali ada data baru
    if (typeof applyTierRestrictions === "function") applyTierRestrictions();
  }, (error) => {
    console.error("Gagal membaca data dari Firebase:", error);
    showToast("Gagal menyinkronkan data", "error");
  });
}

// Add New Activity
// Cari fungsi submit form dan ubah isinya menjadi seperti ini:
const activityFormEl = document.getElementById('activityForm');
if (activityFormEl) {
  activityFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!userActivitiesRef) return;

    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...`;

    try {
      // 1. CEK LIMIT UNTUK AKUN FREE SEBELUM MENYIMPAN
      const snapshot = await userActivitiesRef.once('value');
      const currentDataCount = snapshot.val() ? Object.keys(snapshot.val()).length : 0;
      
      if (window.USER_TIER === 'free' && currentDataCount >= 5) {
        showToast("Limit 5 aktivitas tercapai! Silakan upgrade ke Premium.", "error");
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Simpan Aktivitas`;
        return; // Hentikan proses simpan
      }

      // 2. LANJUTKAN PROSES SIMPAN JIKA AMAN
      const title = document.getElementById('inputTitle').value.trim();
      const category = document.getElementById('inputCategory').value;
      const duration = parseInt(document.getElementById('inputDuration').value);
      const dateTime = document.getElementById('inputDateTime').value;
      const notes = document.getElementById('inputNotes').value.trim();

      const newActivity = {
        title, category, duration, dateTime, notes,
        createdAt: new Date().toISOString()
      };

      await userActivitiesRef.push(newActivity);
      showToast("Aktivitas tersimpan!", "success");
      activityFormEl.reset();
      closeActivityModal();

      const resetNow = new Date();
      resetNow.setMinutes(resetNow.getMinutes() - resetNow.getTimezoneOffset());
      document.getElementById('inputDateTime').value = resetNow.toISOString().slice(0, 16);

    } catch (err) {
      showToast("Gagal menyimpan data", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Simpan Aktivitas`;
    }
  });
}

// Delete Activity
async function deleteActivity(id) {
  if (!confirm("Hapus aktivitas ini?")) return;
  try {
    await userActivitiesRef.child(id).remove();
    showToast("Aktivitas dihapus!", "success");
  } catch (err) {
    showToast("Gagal menghapus", "error");
  }
}

// =============================================================
// LOGIKA RENDER UI & PAGINASI
// =============================================================
function renderUI() {
  const searchInput = document.getElementById('searchFilter');
  const categorySelect = document.getElementById('categoryFilter');

  const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
  const catVal = categorySelect ? categorySelect.value : 'ALL';

  const filtered = allActivities.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(searchVal) || (item.notes && item.notes.toLowerCase().includes(searchVal));
    const matchCat = catVal === 'ALL' || item.category === catVal;
    return matchSearch && matchCat;
  });

  // Hitung total halaman
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  // Slicing data sesuai halaman aktif
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = filtered.slice(startIndex, endIndex);

  renderTable(pageData);
  renderPagination(totalItems, totalPages);
  renderMetrics(allActivities);
  renderCharts(allActivities);
  renderForecastChart(allActivities);  
}

// Reset halaman saat filter berubah
const searchFilterEl = document.getElementById('searchFilter');
if (searchFilterEl) {
  searchFilterEl.addEventListener('input', () => { currentPage = 1; renderUI(); });
}

const categoryFilterEl = document.getElementById('categoryFilter');
if (categoryFilterEl) {
  categoryFilterEl.addEventListener('change', () => { currentPage = 1; renderUI(); });
}

function changeItemsPerPage(val) {
  itemsPerPage = parseInt(val);
  currentPage = 1;
  renderUI();
}

function goToPage(page) {
  currentPage = page;
  renderUI();
}

function renderPagination(totalItems, totalPages) {
  const infoEl = document.getElementById('paginationInfo');
  const totalEl = document.getElementById('paginationTotal');
  const navEl = document.getElementById('paginationNav');

  if (!infoEl || !navEl) return;

  const start = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  infoEl.innerText = `${start} - ${end}`;
  if (totalEl) totalEl.innerText = totalItems;

  navEl.innerHTML = '';
  if (totalPages <= 1) return;

  // Tombol Previous
  const prevBtn = document.createElement('button');
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => goToPage(currentPage - 1);
  prevBtn.className = `px-2.5 py-1 rounded-lg text-xs font-semibold transition ${currentPage === 1 ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200'}`;
  prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
  navEl.appendChild(prevBtn);

  let startPage = Math.max(1, currentPage - 1);
  let endPage = Math.min(totalPages, currentPage + 1);

  if (currentPage === 1) endPage = Math.min(3, totalPages);
  if (currentPage === totalPages) startPage = Math.max(1, totalPages - 2);

  if (startPage > 1) {
    navEl.appendChild(createPageBtn(1));
    if (startPage > 2) navEl.appendChild(createEllipsis());
  }

  for (let i = startPage; i <= endPage; i++) {
    navEl.appendChild(createPageBtn(i));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) navEl.appendChild(createEllipsis());
    navEl.appendChild(createPageBtn(totalPages));
  }

  // Tombol Next
  const nextBtn = document.createElement('button');
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => goToPage(currentPage + 1);
  nextBtn.className = `px-2.5 py-1 rounded-lg text-xs font-semibold transition ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200'}`;
  nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
  navEl.appendChild(nextBtn);
}

function createPageBtn(pageNum) {
  const btn = document.createElement('button');
  btn.onclick = () => goToPage(pageNum);
  const isActive = pageNum === currentPage;
  btn.className = `px-3 py-1 rounded-lg text-xs font-semibold transition ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`;
  btn.innerText = pageNum;
  return btn;
}

function createEllipsis() {
  const span = document.createElement('span');
  span.className = 'px-1 text-xs text-slate-400';
  span.innerText = '...';
  return span;
}

// =============================================================
// RENDER TABEL, METRIK & GRAFIK
// =============================================================
function renderTable(data) {
  const tbody = document.getElementById('activityTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-400">Belum ada data aktivitas.</td></tr>`;
    return;
  }

  data.forEach(item => {
    const dateObj = new Date(item.dateTime);
    const formattedDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const formattedTime = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const badgeColors = {
      'Olahraga': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      'Belajar': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      'Pekerjaan': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      'Hiburan': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      'Istirahat': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      'Lainnya': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
    };

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition";
    tr.innerHTML = `
      <td class="p-3 text-xs text-slate-500 dark:text-slate-400 font-mono">${formattedDate}, ${formattedTime}</td>
      <td class="p-3 font-medium text-slate-800 dark:text-white">${escapeHtml(item.title)}</td>
      <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-medium border ${badgeColors[item.category] || badgeColors['Lainnya']}">${item.category}</span></td>
      <td class="p-3 text-xs font-semibold">${item.duration} Mins</td>
      <td class="p-3 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">${item.notes ? escapeHtml(item.notes) : '-'}</td>
      <td class="p-3 text-right"><button onclick="deleteActivity('${item.id}')" class="text-slate-400 hover:text-red-500 p-1 text-xs"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMetrics(data) {
  const todayStr = new Date().toISOString().split('T')[0];
  let todayDuration = 0, todayCount = 0, totalDuration = 0;
  const catCount = {};

  data.forEach(item => {
    totalDuration += Number(item.duration);
    catCount[item.category] = (catCount[item.category] || 0) + 1;
    if (item.dateTime && item.dateTime.startsWith(todayStr)) {
      todayDuration += Number(item.duration);
      todayCount++;
    }
  });

  const totalHours = (totalDuration / 60).toFixed(1);
  const statTodayDur = document.getElementById('statTodayDuration');
  const statTodaySub = document.getElementById('statTodaySub');
  const statTotalDur = document.getElementById('statTotalDuration');
  const statTotalCnt = document.getElementById('statTotalCount');

  if (statTodayDur) statTodayDur.innerText = `${todayDuration} Menit`;
  if (statTodaySub) statTodaySub.innerText = `${todayCount} aktivitas dicatat hari ini`;
  if (statTotalDur) statTotalDur.innerText = `${totalHours} Jam`;
  if (statTotalCnt) statTotalCnt.innerText = `${data.length} total entri tersimpan`;

  const profEntries = document.getElementById('profileTotalEntries');
  const profHours = document.getElementById('profileTotalHours');
  if (profEntries) profEntries.innerText = `${data.length} Entri`;
  if (profHours) profHours.innerText = `${totalHours} Jam`;

  let topCat = '-';
  let maxC = 0;
  Object.keys(catCount).forEach(cat => {
    if (catCount[cat] > maxC) { maxC = catCount[cat]; topCat = cat; }
  });
  const statTopCat = document.getElementById('statTopCategory');
  if (statTopCat) statTopCat.innerText = topCat;

  const statLastAct = document.getElementById('statLastActivity');
  const statLastTm = document.getElementById('statLastTime');
  if (data.length > 0) {
    if (statLastAct) statLastAct.innerText = data[0].title;
    if (statLastTm) statLastTm.innerText = new Date(data[0].dateTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } else {
    if (statLastAct) statLastAct.innerText = '-';
    if (statLastTm) statLastTm.innerText = 'Belum ada data';
  }
}

function renderCharts(data) {
    // 1. Ubah Object menjadi Array
    const activitiesArray = Object.values(data);

    // 2. Gunakan nama parameter yang konsisten (misal: 'activity')
    activitiesArray.forEach(activity => {
        // Gunakan console.log yang benar
        console.log(activity.title); 
    });

    const isDark = htmlEl.classList.contains('dark');
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    const subTextColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const catTotals = { 'Olahraga': 0, 'Belajar': 0, 'Pekerjaan': 0, 'Hiburan': 0, 'Istirahat': 0, 'Lainnya': 0 };
    
    activitiesArray.forEach(activity => {
        // Ganti 'item' menjadi 'activity'
        if (catTotals[activity.category] !== undefined) {
            catTotals[activity.category] += Number(activity.duration);
        } else {
            catTotals['Lainnya'] += Number(activity.duration);
        }
    });
}

  const catCanvas = document.getElementById('categoryChart');
  if (catCanvas) {
    const ctxCat = catCanvas.getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catTotals),
        datasets: [{
          data: Object.values(catTotals),
          backgroundColor: ['#3b82f6', '#6366f1', '#f59e0b', '#a855f7', '#10b981', '#64748b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: subTextColor, font: { size: 10 } } },
          title: { display: true, text: 'Distribusi Durasi (Menit)', color: textColor, font: { size: 12 } }
        }
      }
    });
  }

  const last7Days = [];
  const dayDurations = Array(7).fill(0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
  }

  data.forEach(item => {
    const itemDate = new Date(item.dateTime);
    const now = new Date();
    const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) {
      dayDurations[6 - diffDays] += Number(item.duration);
    }
  });

  const weeklyCanvas = document.getElementById('weeklyChart');
  if (weeklyCanvas) {
    const ctxWeekly = weeklyCanvas.getContext('2d');
    if (weeklyChartInstance) weeklyChartInstance.destroy();
    weeklyChartInstance = new Chart(ctxWeekly, {
      type: 'bar',
      data: {
        labels: last7Days,
        datasets: [{ label: 'Durasi (Menit)', data: dayDurations, backgroundColor: '#6366f1', borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Aktivitas 7 Hari Terakhir', color: textColor, font: { size: 12 } }
        },
        scales: {
          x: { ticks: { color: subTextColor, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: subTextColor, font: { size: 10 } }, grid: { color: gridColor } }
        }
      }
    });
  }


function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast || !toastMsg || !toastIcon) return;

  toastMsg.innerText = msg;
  toastIcon.className = type === 'success' ? 'fa-solid fa-circle-check text-emerald-400 text-lg' : 'fa-solid fa-circle-xmark text-red-400 text-lg';

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// FUNGSI UNTUK MENGAPLIKASIKAN PERUBAHAN DROPDOWN FORECAST
function updateForecastCategory() {
  if (window.cachedActivities) {
    renderForecastChart(window.cachedActivities);
  }
}

// VARIABEL INSTANS GRAFIK PROYEKSI
function renderForecastChart(data) {
  const forecastCanvas = document.getElementById('forecastChart');
  if (!forecastCanvas) return;

  // Simpan data di memori global agar fungsi dropdown bisa memanggil ulang
  window.cachedActivities = data;

  const isDark = htmlEl.classList.contains('dark');
  const textColor = isDark ? '#f8fafc' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  // 1. Ambil Kategori dari Dropdown & Batas Maksimal Mutlak (5 Jam / 300 Menit)
  const categorySelect = document.getElementById('forecastCategorySelect');
  const TARGET_CATEGORY = categorySelect ? categorySelect.value : 'Olahraga'; 
  const MAX_CATEGORY_MINUTES = 300; // Maksimal 5 Jam per hari

  const dailyTotals = {};
  const now = new Date();
  
  data.forEach(item => {
    if (item.category === TARGET_CATEGORY) {
      const itemDate = new Date(item.dateTime);
      const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 14) {
        const dateKey = itemDate.toISOString().split('T')[0];
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + Number(item.duration);
      }
    }
  });

  const totalDays = Object.keys(dailyTotals).length || 1;
  const totalMins = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
  
  // Potong maksimal 300 menit (5 Jam)
  const rawAvg = Math.round(totalMins / totalDays) || 45;
  const avgMins = Math.min(MAX_CATEGORY_MINUTES, rawAvg);

  // Formatting teks ramah pengguna
  const avgHours = (avgMins / 60).toFixed(1);
  const readableAvg = avgMins >= 60 ? `${avgHours} Jam` : `${avgMins} Menit`;

  // Update teks penjelasan di atas grafik
  const explanationEl = document.getElementById('forecastExplanationText');
  if (explanationEl) {
    explanationEl.innerHTML = `
      Garis putus-putus (<span class="text-blue-500 font-semibold">---</span>) menunjukkan estimasi target waktu <strong>${TARGET_CATEGORY}</strong> untuk 7 hari ke depan. 
      Berdasarkan tren 14 hari terakhir, perkiraan alokasi waktu sekitar <strong class="text-slate-800 dark:text-white">${readableAvg}/hari</strong> (dibatasi maksimum 5 jam/hari).
    `;
  }

  // 2. Buat Data Proyeksi 7 Hari Ke Depan (Terkunci Maksimal 300 Menit)
  const next7Days = [];
  const projectedValues = [];

  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + i);
    next7Days.push(futureDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
    
    // Variasi acak ±10% yang terkunci aman di bawah 300 menit (5 Jam)
    const variation = (Math.random() * 0.2 - 0.1) * avgMins;
    const finalVal = Math.min(MAX_CATEGORY_MINUTES, Math.max(15, Math.round(avgMins + variation)));
    projectedValues.push(finalVal);
  }

  // 3. Render Grafik Chart.js
  const ctxForecast = forecastCanvas.getContext('2d');
  if (forecastChartInstance) forecastChartInstance.destroy();

  forecastChartInstance = new Chart(ctxForecast, {
    type: 'line',
    data: {
      labels: next7Days,
      datasets: [{
        label: `Proyeksi ${TARGET_CATEGORY}`,
        data: projectedValues,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderDash: [5, 5],
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#3b82f6'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { 
          display: true, 
          text: `Target Rata-Rata ${TARGET_CATEGORY}: ~${readableAvg}/Hari`, 
          color: textColor, 
          font: { size: 12 } 
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const hrs = (val / 60).toFixed(1);
              return val >= 60 
                ? ` Estimasi Target: ${hrs} Jam (${val} Menit)` 
                : ` Estimasi Target: ${val} Menit`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: subTextColor, font: { size: 10 } }, grid: { display: false } },
        y: { 
          min: 0,
          max: 300, // Sumbu Y dibatasi tepat pada 300 Menit (5 Jam)
          ticks: { 
            color: subTextColor, 
            font: { size: 10 },
            stepSize: 60, // Kelipatan 1 Jam
            callback: function(value) {
              return value >= 60 ? (value / 60).toFixed(0) + ' Jam' : value + ' Mins';
            }
          }, 
          grid: { color: gridColor } 
        }
      }
    }
  });
}
// ==================== FUNGSI MODAL POP-UP TAMBAH DATA ====================

function openActivityModal() {
  const modal = document.getElementById('activityModal');
  if (!modal) return;
  
  // Set default datetime-local ke waktu lokal saat ini
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const inputDateTime = document.getElementById('inputDateTime');
  if (inputDateTime) {
    inputDateTime.value = now.toISOString().slice(0, 16);
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    if (modal.children[0]) {
      modal.children[0].classList.remove('scale-95');
      modal.children[0].classList.add('scale-100');
    }
  }, 10);
}

function closeActivityModal() {
  const modal = document.getElementById('activityModal');
  if (!modal) return;
  
  modal.classList.add('opacity-0');
  if (modal.children[0]) {
    modal.children[0].classList.remove('scale-100');
    modal.children[0].classList.add('scale-95');
  }
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function handleModalBackdropClick(e) {
  if (e.target.id === 'activityModal') {
    closeActivityModal();
  }
}

// Tutup modal jika tombol Esc ditekan
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeActivityModal();
});

// ==================== FUNGSI RESET / HAPUS MASSAL DATA ====================

async function resetAllData() {
  if (!userActivitiesRef) {
    showToast("Gagal: Database tidak terhubung.", "error");
    return;
  }

  // 1. Konfirmasi Keamanan Pertama
  const confirmFirst = confirm("⚠️ PERINGATAN!\n\nApakah kamu yakin ingin menghapus SEMUA data aktivitas?\nSeluruh riwayat akan dihapus permanen dari cloud dan tidak dapat dikembalikan.");
  if (!confirmFirst) return;

  // 2. Konfirmasi Keamanan Kedua (Ketik 'HAPUS')
  const confirmText = prompt("Ketik kata 'HAPUS' (huruf besar) untuk mengonfirmasi pembersihan data:");
  if (confirmText !== "HAPUS") {
    showToast("Reset dibatalkan (kata konfirmasi tidak sesuai).", "error");
    return;
  }

  try {
    await userActivitiesRef.remove();
    showToast("Seluruh data berhasil dihapus bersih!", "success");
  } catch (error) {
    console.error("Error resetting data:", error);
    showToast("Gagal menghapus data dari database.", "error");
  }
}

// ==================== FUNGSI HAPUS DATA SETELAH TANGGAL TERTENTU ====================

async function deleteDataAfterDate() {
  if (!userActivitiesRef) {
    showToast("Gagal: Database tidak terhubung.", "error");
    return;
  }

  // 1. Minta input tanggal batas dari pengguna
  const selectedDateStr = prompt("Masukkan tanggal batas awal penghapusan (Format: YYYY-MM-DD):\n\nContoh: 2026-10-01 (Semua data dari 1 Oktober 2026 ke depan akan dihapus!)");
  if (!selectedDateStr) return;

  const targetDate = new Date(selectedDateStr);
  targetDate.setHours(0, 0, 0, 0);

  if (isNaN(targetDate.getTime())) {
    showToast("Format tanggal tidak valid! Gunakan format YYYY-MM-DD", "error");
    return;
  }

  // 2. Konfirmasi tindakan
  const confirmDelete = confirm(`⚠️ PERINGATAN!\n\nApakah kamu yakin ingin menghapus SEMUA data dari tanggal ${selectedDateStr} hingga sekarang?`);
  if (!confirmDelete) return;

  try {
    const snapshot = await userActivitiesRef.once('value');
    const data = snapshot.val();
    
    if (!data) {
      showToast("Tidak ada data untuk dihapus.", "error");
      return;
    }

    let deletedCount = 0;
    const updates = {};

    // 3. Filter data yang tanggalnya sama atau setelah tanggal batas
    Object.keys(data).forEach(key => {
      const item = data[key];
      const itemDate = new Date(item.dateTime || item.createdAt);
      
      if (itemDate >= targetDate) {
        updates[key] = null;
        deletedCount++;
      }
    });

    if (deletedCount === 0) {
      showToast("Tidak ditemukan data pada atau setelah tanggal tersebut.", "error");
      return;
    }

    // 4. Eksekusi penghapusan masal
    await userActivitiesRef.update(updates);
    showToast(`Berhasil menghapus ${deletedCount} entri data!`, "success");
  } catch (error) {
    console.error("Error deleting date-filtered data:", error);
    showToast("Gagal menghapus data dari database.", "error");
  }
}

// ==================== FUNGSI PAYWALL & LIMITASI TIER ====================

function applyTierRestrictions() {
  if (window.USER_TIER !== 'free') return; // Lewati jika Premium

  // 1. Batasi Kategori Hanya 3 (Matikan yang lain)
  const allowedCategories = ['Olahraga', 'Pekerjaan', 'Istirahat'];
  const categorySelects = document.querySelectorAll('#inputCategory, #forecastCategorySelect');
  
  categorySelects.forEach(select => {
    Array.from(select.options).forEach(opt => {
      if (opt.value !== 'ALL' && !allowedCategories.includes(opt.value)) {
        opt.disabled = true;
        opt.text += ' 🔒';
      }
    });
  });

  // 2. Kunci Tombol Export, Import, Reset, dan Hapus Filter
  const premiumButtons = [
    'button[onclick="triggerFileInput()"]',
    'button[onclick="downloadCSVTemplate()"]',
    'button[onclick="exportToCSV()"]',
    'button[onclick="exportToPDF()"]',
    'button[onclick="resetAllData()"]',
    'button[onclick="deleteDataAfterDate()"]'
  ];

  premiumButtons.forEach(selector => {
    const btn = document.querySelector(selector);
    if (btn) {
      btn.classList.add('opacity-50', 'cursor-not-allowed', 'grayscale');
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast("Fitur khusus Premium! 🔒", "error");
      };
    }
  });

  // 3. Efek Overlay Lock (Blur) pada AI Forecast & Grafik Mingguan
  function addLockOverlay(elementId, title) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const parentContainer = el.parentElement;
    parentContainer.classList.add('relative');
    
    // Cegah duplikasi overlay
    if (!parentContainer.querySelector('.paywall-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'paywall-overlay absolute inset-0 bg-slate-900/60 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white z-20 cursor-not-allowed border border-amber-500/30';
      overlay.innerHTML = `
        <i class="fa-solid fa-lock text-3xl mb-2 text-amber-400 drop-shadow-md"></i>
        <h3 class="font-bold text-sm text-slate-100">${title}</h3>
        <span class="mt-2 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-[10px] font-bold shadow-lg">UPGRADE PREMIUM</span>
      `;
      parentContainer.appendChild(overlay);
    }
  }

  // Terapkan gembok ke elemen grafik tertentu
  setTimeout(() => {
    addLockOverlay('forecastChart', 'AI Forecast Terkunci');
    addLockOverlay('weeklyChart', 'Analisis Lanjutan Terkunci');
  }, 500); // Jeda sejenak untuk memastikan canvas sudah di-render HTML
}

// Panggil fungsi ini tepat setelah halaman/aplikasi dimuat
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(applyTierRestrictions, 1000);
});

// ==================== FUNGSI KEMAS KINI UI PROFIL & NAIK TARAF ====================

function updateProfileTierUI() {
  const badge = document.getElementById('profileTierBadge');
  const promo = document.getElementById('upgradePromoCard');
  
  if (!badge) return;

  if (window.USER_TIER === 'premium') {
    // Paparan Premium
    badge.className = 'px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-[11px] font-bold uppercase tracking-wider shadow-sm inline-block';
    badge.innerHTML = '<i class="fa-solid fa-crown mr-1"></i> Akaun Premium';
    if (promo) promo.classList.add('hidden'); // Sembunyikan kad promosi
  } else {
    // Paparan Percuma
    badge.className = 'px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-[11px] font-bold uppercase tracking-wider inline-block';
    badge.innerHTML = 'Akaun Percuma (Free)';
    if (promo) promo.classList.remove('hidden'); // Tunjukkan kad promosi
  }
}

// Panggil fungsi ini untuk mengemas kini profil sejurus halaman dimuatkan
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(updateProfileTierUI, 1000);
});

// Fungsi simulasi klik butang "Naik Taraf Sekarang"
// ==================== FUNGSI SIMULASI PAYMENT GATEWAY ====================

// Buka Modal Pembayaran (Menggantikan confirm prompt lama)
function upgradeToPremium() {
  // --- FIX KETUMPUK: Sembunyikan modal admin jika terbuka ---
  const adModal = document.getElementById('adminModal');
  if (adModal) adModal.classList.add('hidden', 'opacity-0');
  // ----------------------------------------------------------

  const modal = document.getElementById('paymentModal');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  
  //const modal = document.getElementById('paymentModal');
  //if (!modal) return;
  
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    if(modal.children[0]) {
      modal.children[0].classList.remove('scale-95');
      modal.children[0].classList.add('scale-100');
    }
  }, 10);
}

// Tutup Modal Pembayaran
function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (!modal) return;
  
  modal.classList.add('opacity-0');
  if(modal.children[0]) {
    modal.children[0].classList.remove('scale-100');
    modal.children[0].classList.add('scale-95');
  }
  
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

// Membuka Tab Lynk.id dan Mengubah UI Modal
function openLynkPayment() {
  const btn = document.getElementById('btnProceedLynk');
  btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Membuka Lynk.id...`;
  
  // GANTI URL INI DENGAN LINK PRODUK LYNK.ID MILIKMU!
  // Contoh: "https://lynk.id/namakamu/s/XyZ123"
  const lynkUrl = "https://lynk.id/"; 
  
  setTimeout(() => {
    // 1. Buka tab baru ke halaman pembayaran Lynk.id
    window.open(lynkUrl, '_blank');
    
    // 2. Ganti tampilan UI ke status menunggu konfirmasi
    document.getElementById('paymentSelection').classList.add('hidden');
    document.getElementById('paymentConfirmation').classList.remove('hidden');
    document.getElementById('paymentConfirmation').classList.add('flex');
  }, 800);
}

// Proses verifikasi setelah pengguna mengklik "Saya Sudah Bayar"
function processPayment() {
  const btn = document.getElementById('btnConfirmPayment');
  
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Memverifikasi Transaksi...`;
  btn.classList.add('opacity-80', 'cursor-not-allowed');

  // Jeda 2.5 detik untuk simulasi pengecekan
  setTimeout(() => {
    localStorage.setItem('userTier', 'premium');
    closePaymentModal();
    showToast("Pembayaran Berhasil Diverifikasi! Akun Anda kini PREMIUM. 👑", "success");
    
    setTimeout(() => location.reload(), 1500);
  }, 2500);
}

// Proses verifikasi simulasi setelah user pura-pura scan
function processPayment() {
  const btn = document.getElementById('btnConfirmPayment');
  
  // Ubah tombol jadi loading
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Memverifikasi Transaksi...`;
  btn.classList.add('opacity-80', 'cursor-not-allowed');

  // Jeda 2.5 detik untuk simulasi komunikasi webhook dengan server bank
  setTimeout(() => {
    localStorage.setItem('userTier', 'premium');
    closePaymentModal();
    showToast("Pembayaran Berhasil! Akun Anda kini PREMIUM. 👑", "success");
    
    // Refresh halaman agar semua fitur terbuka
    setTimeout(() => location.reload(), 1500);
  }, 2500);
}

// Fungsi bantu untuk patah balik ke akaun percuma (bagi tujuan ujian)
function resetToFree() {
  localStorage.setItem('userTier', 'free');
  showToast("Akaun dikembalikan kepada Percuma. Memuat semula...", "error");
  setTimeout(() => location.reload(), 1000);
}

// ==================== FUNGSI SUPER ADMIN ====================

// 1. Munculkan tombol admin jika yang login adalah admin
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem('isAdmin') === 'true') {
    const adminBtn = document.getElementById('btnOpenAdmin');
    if (adminBtn) adminBtn.classList.remove('hidden');
  }
});

// 2. Buka Modal & Ambil Data Semua User
async function openAdminPanel() {
  // 1. Sembunyikan modal pembayaran
  const payModal = document.getElementById('paymentModal');
  if (payModal) payModal.classList.add('hidden', 'opacity-0');

  // 2. Deklarasikan modal admin (CUKUP SATU KALI SAJA)
  const modal = document.getElementById('adminModal');
  
  if (!modal) {
    alert("GAGAL MEMBUKA: Kode HTML belum ditambahkan!");
    return;
  }
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
  
  // ... Lanjut ke kode tabel ...
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
  
  const tbody = document.getElementById('adminUserTableBody');
  tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-500"><i class="fa-solid fa-spinner animate-spin text-2xl mb-2"></i><br>Memuat database...</td></tr>';
  
  try {
    // Ambil data node 'users' dari Firebase Realtime Database
    const usersSnapshot = await firebase.database().ref('users').once('value');
    const usersData = usersSnapshot.val();
    
    tbody.innerHTML = ''; 
    
    if (!usersData) {
      tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center">Belum ada pengguna terdaftar.</td></tr>';
      return;
    }

    Object.keys(usersData).forEach(uid => {
      const u = usersData[uid];
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition';
      
      const isPremium = u.tier === 'premium';
      const tierBadge = isPremium 
        ? '<span class="px-2 py-1 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-bold"><i class="fa-solid fa-crown"></i> PREMIUM</span>'
        : '<span class="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold">FREE</span>';
      
      tr.innerHTML = `
        <td class="p-4 font-medium text-slate-800 dark:text-slate-200">${u.email || '-'}</td>
        <td class="p-4">${tierBadge}</td>
        <td class="p-4 text-xs">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}</td>
        <td class="p-4 text-center">
          ${!isPremium ? `
            <button onclick="forcePremium('${uid}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow-sm">
              Upgrade
            </button>
          ` : `
            <button onclick="revokePremium('${uid}')" class="px-3 py-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition shadow-sm">
              Downgrade
            </button>
          `}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-rose-500 font-bold">Akses Ditolak. Pastikan Rules Firebase Database diizinkan untuk Admin.</td></tr>`;
  }
}

// 3. Tutup Panel Admin
function closeAdminPanel() {
  const modal = document.getElementById('adminModal');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

// 4. Aksi Ubah Tier User (Kirim Perintah ke Firebase)
async function forcePremium(uid) {
  if(confirm('Berikan akses PREMIUM secara gratis untuk user ini?')) {
    await firebase.database().ref('users/' + uid).update({ tier: 'premium' });
    showToast('Akses berhasil diupgrade!', 'success');
    openAdminPanel(); // Segarkan tabel
  }
}

async function revokePremium(uid) {
  if(confirm('Cabut akses PREMIUM dari user ini?')) {
    await firebase.database().ref('users/' + uid).update({ tier: 'free' });
    showToast('Akses premium dicabut!', 'success');
    openAdminPanel(); // Segarkan tabel
  }
}

// =============================================================
// MODUL DASHBOARD, GRAFIK & PAGINASI (app.js)
// =============================================================

// Default Datetime Local Input
let forecastChartInstance = null;
const now = new Date();

now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
const inputDateEl = document.getElementById('inputDateTime');
if (inputDateEl) inputDateEl.value = now.toISOString().slice(0, 16);

// Realtime Firebase Listener
function listenToUserActivities() {
  if (!userActivitiesRef) return;

  userActivitiesRef.on('value', (snapshot) => {
    const data = snapshot.val();
    allActivities = [];
    
    if (data) {
      Object.keys(data).forEach((key) => {
        allActivities.push({ id: key, ...data[key] });
      });
      allActivities.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    }

    renderUI();
  }, (error) => {
    console.error("Firebase Read Error:", error);
    showToast("Gagal membaca data.", "error");
  });
}

// Add New Activity
const activityFormEl = document.getElementById('activityForm');
if (activityFormEl) {
  activityFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!userActivitiesRef) return;

    const title = document.getElementById('inputTitle').value.trim();
    const category = document.getElementById('inputCategory').value;
    const duration = parseInt(document.getElementById('inputDuration').value);
    const dateTime = document.getElementById('inputDateTime').value;
    const notes = document.getElementById('inputNotes').value.trim();

    const newActivity = {
      title, category, duration, dateTime, notes,
      createdAt: new Date().toISOString()
    };

    try {
      const btn = document.getElementById('btnSubmit');
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...`;

      await userActivitiesRef.push(newActivity);
      showToast("Aktivitas tersimpan!", "success");
      document.getElementById('activityForm').reset();
      
      const resetNow = new Date();
      resetNow.setMinutes(resetNow.getMinutes() - resetNow.getTimezoneOffset());
      document.getElementById('inputDateTime').value = resetNow.toISOString().slice(0, 16);
    } catch (err) {
      showToast("Gagal menyimpan data", "error");
    } finally {
      const btn = document.getElementById('btnSubmit');
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
  const isDark = htmlEl.classList.contains('dark');
  const textColor = isDark ? '#f8fafc' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  const catTotals = { 'Olahraga': 0, 'Belajar': 0, 'Pekerjaan': 0, 'Hiburan': 0, 'Istirahat': 0, 'Lainnya': 0 };
  data.forEach(item => {
    if (catTotals[item.category] !== undefined) {
      catTotals[item.category] += Number(item.duration);
    } else {
      catTotals['Lainnya'] += Number(item.duration);
    }
  });

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

// VARIABEL INSTANS GRAFIK PROYEKSI
function renderForecastChart(data) {
  const forecastCanvas = document.getElementById('forecastChart');
  if (!forecastCanvas) return;

  const isDark = htmlEl.classList.contains('dark');
  const textColor = isDark ? '#f8fafc' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  // 1. Tentukan Kategori Target & Batas Maksimal Realistis (5 Jam / 300 Menit)
  const TARGET_CATEGORY = 'Olahraga'; 
  const MAX_CATEGORY_MINUTES = 300; // Maksimal 5 Jam per hari per kategori

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
  
  // Hitung rata-rata & terapkan batas maksimal 300 menit (5 Jam)
  let avgMins = Math.round(totalMins / totalDays) || 45;
  if (avgMins > MAX_CATEGORY_MINUTES) {
    avgMins = MAX_CATEGORY_MINUTES;
  }

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

  // 2. Buat Data Proyeksi 7 Hari Ke Depan
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
          beginAtZero: true,
          max: 300, // Sumbu Y dibatasi tepat pada 300 Menit (5 Jam)
          ticks: { 
            color: subTextColor, 
            font: { size: 10 },
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

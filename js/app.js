// Default Datetime Local Input
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
document.getElementById('inputDateTime').value = now.toISOString().slice(0, 16);

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
document.getElementById('activityForm').addEventListener('submit', async (e) => {
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

// Render UI Components
function renderUI() {
  const searchVal = document.getElementById('searchFilter').value.toLowerCase();
  const catVal = document.getElementById('categoryFilter').value;

  const filtered = allActivities.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(searchVal) || (item.notes && item.notes.toLowerCase().includes(searchVal));
    const matchCat = catVal === 'ALL' || item.category === catVal;
    return matchSearch && matchCat;
  });

  renderTable(filtered);
  renderMetrics(allActivities);
  renderCharts(allActivities);
}

document.getElementById('searchFilter').addEventListener('input', renderUI);
document.getElementById('categoryFilter').addEventListener('change', renderUI);

function renderTable(data) {
  const tbody = document.getElementById('activityTableBody');
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
  document.getElementById('statTodayDuration').innerText = `${todayDuration} Menit`;
  document.getElementById('statTodaySub').innerText = `${todayCount} aktivitas dicatat hari ini`;
  document.getElementById('statTotalDuration').innerText = `${totalHours} Jam`;
  document.getElementById('statTotalCount').innerText = `${data.length} total entri tersimpan`;

  document.getElementById('profileTotalEntries').innerText = `${data.length} Entri`;
  document.getElementById('profileTotalHours').innerText = `${totalHours} Jam`;

  let topCat = '-';
  let maxC = 0;
  Object.keys(catCount).forEach(cat => {
    if (catCount[cat] > maxC) { maxC = catCount[cat]; topCat = cat; }
  });
  document.getElementById('statTopCategory').innerText = topCat;

  if (data.length > 0) {
    document.getElementById('statLastActivity').innerText = data[0].title;
    document.getElementById('statLastTime').innerText = new Date(data[0].dateTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } else {
    document.getElementById('statLastActivity').innerText = '-';
    document.getElementById('statLastTime').innerText = 'Belum ada data';
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

  const ctxCat = document.getElementById('categoryChart').getContext('2d');
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

  const ctxWeekly = document.getElementById('weeklyChart').getContext('2d');
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

  toastMsg.innerText = msg;
  toastIcon.className = type === 'success' ? 'fa-solid fa-circle-check text-emerald-400 text-lg' : 'fa-solid fa-circle-xmark text-red-400 text-lg';

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

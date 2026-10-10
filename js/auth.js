// Dark / Light Theme Toggle
const htmlEl = document.documentElement;
const currentTheme = localStorage.getItem('appTheme') || 'dark';

function applyTheme(theme) {
  const iconAuth = document.getElementById('themeIconAuth');
  const iconApp = document.getElementById('themeIconApp');

  if (theme === 'dark') {
    htmlEl.classList.add('dark');
    if (iconAuth) iconAuth.className = 'fa-solid fa-sun';
    if (iconApp) iconApp.className = 'fa-solid fa-sun';
  } else {
    htmlEl.classList.remove('dark');
    if (iconAuth) iconAuth.className = 'fa-solid fa-moon';
    if (iconApp) iconApp.className = 'fa-solid fa-moon';
  }
  localStorage.setItem('appTheme', theme);

  if (typeof renderCharts === 'function' && allActivities && allActivities.length > 0) {
    renderCharts(allActivities);
  }
}

function toggleTheme() {
  const isDark = htmlEl.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

applyTheme(currentTheme);

// Auth Observer
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    document.body.classList.remove('flex', 'flex-col', 'justify-center', 'items-center');

    updateProfileUI(user);
    userActivitiesRef = db.ref(`users/${user.uid}/activities`);
    listenToUserActivities();
    showToast(`Selamat datang, ${user.displayName || user.email}!`, 'success');
  } else {
    currentUser = null;
    userActivitiesRef = null;
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
    document.body.classList.add('flex', 'flex-col', 'justify-center', 'items-center');
  }
});

function switchAuthTab(mode) {
  isLoginMode = mode === 'login';
  const btnLogin = document.getElementById('btnTabLogin');
  const btnRegister = document.getElementById('btnTabRegister');
  const btnSubmit = document.getElementById('btnAuthSubmit');
  const subtitle = document.getElementById('authSubtitle');

  if (isLoginMode) {
    btnLogin.className = "flex-1 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white transition shadow-sm";
    btnRegister.className = "flex-1 py-2 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 transition";
    btnSubmit.innerText = "Masuk";
    subtitle.innerText = "Masuk untuk mengelola data aktivitas pribadi kamu";
  } else {
    btnRegister.className = "flex-1 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white transition shadow-sm";
    btnLogin.className = "flex-1 py-2 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 transition";
    btnSubmit.innerText = "Daftar Akun Baru";
    subtitle.innerText = "Buat akun privat baru untuk menyimpan aktivitas kamu";
  }
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const btnSubmit = document.getElementById('btnAuthSubmit');

  try {
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Memproses...";
    if (isLoginMode) {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
    }
  } catch (err) {
    showToast(err.message || "Gagal otentikasi", "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerText = isLoginMode ? "Masuk" : "Daftar Akun Baru";
  }
});

function logout() {
  auth.signOut().then(() => showToast("Berhasil keluar.", "success"));
}

function switchNavTab(tab) {
  const btnDash = document.getElementById('navBtnDashboard');
  const btnProf = document.getElementById('navBtnProfile');
  const viewDash = document.getElementById('dashboardView');
  const viewProf = document.getElementById('profileView');

  if (tab === 'dashboard') {
    btnDash.className = "px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white transition flex items-center gap-2 shadow-sm";
    btnProf.className = "px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 transition flex items-center gap-2";
    viewDash.classList.remove('hidden');
    viewProf.classList.add('hidden');
  } else {
    btnProf.className = "px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white transition flex items-center gap-2 shadow-sm";
    btnDash.className = "px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 transition flex items-center gap-2";
    viewProf.classList.remove('hidden');
    viewDash.classList.add('hidden');
  }
}

function updateProfileUI(user) {
  const dName = user.displayName || user.email.split('@')[0];
  document.getElementById('userEmailDisplay').innerText = dName;
  document.getElementById('profileDisplayName').innerText = dName;
  document.getElementById('profileEmail').innerText = user.email;
  document.getElementById('inputDisplayName').value = dName;
  document.getElementById('inputProfileEmail').value = user.email;
  document.getElementById('profileAvatar').innerText = dName.charAt(0).toUpperCase();

  if (user.metadata && user.metadata.creationTime) {
    const createdDate = new Date(user.metadata.creationTime);
    document.getElementById('profileCreatedDate').innerText = createdDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  }
}

document.getElementById('updateProfileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const newName = document.getElementById('inputDisplayName').value.trim();
  try {
    await currentUser.updateProfile({ displayName: newName });
    updateProfileUI(currentUser);
    showToast("Profil diperbarui!", "success");
  } catch (err) {
    showToast("Gagal memperbarui profil", "error");
  }
});

document.getElementById('updatePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const newPassword = document.getElementById('inputNewPassword').value;
  try {
    await currentUser.updatePassword(newPassword);
    document.getElementById('inputNewPassword').value = '';
    showToast("Kata sandi diperbarui!", "success");
  } catch (err) {
    showToast("Gagal memperbarui sandi.", "error");
  }
});

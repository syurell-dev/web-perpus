const readline = require('readline');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'perpus.db');

let serverProcess = null;
let isServerRunning = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function tampilkanMenu() {
  console.log('\n====================================================');
  console.log('         🚀 TERMINAL MANAGER WEB-PERPUS 🚀          ');
  console.log('====================================================');
  console.log('  [1] Start Server      [2] Stop Server');
  console.log('  [3] Backup DB         [4] Sync Sidebar');
  console.log('  [5] Ganti Emoji       [6] Test DB');
  console.log('  [7] Test Otomatis     [8] Keluar');
  console.log('====================================================');
  if (isServerRunning) {
    console.log(' 🟢 STATUS: SERVER SEDANG BERJALAN');
    console.log('====================================================');
  }
  rl.setPrompt('👉 Pilih menu (ketik angka lalu Enter): ');
  rl.prompt();
}

function startServer() {
  if (isServerRunning) {
    console.log('⚠️ Server sudah berjalan!');
    return tampilkanMenu();
  }
  
  console.log('🚀 Menjalankan Server...');
  console.log('💡 TIPS: Setiap kali Anda menyimpan file, nodemon akan restart, dan menu ini akan otomatis muncul kembali.\n');
  
  isServerRunning = true;
  
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  
  // PENTING: Ubah 'inherit' menjadi 'pipe' agar kita bisa mendengarkan log nodemon
  serverProcess = spawn(npmCmd, ['run', 'dev'], { 
    stdio: ['ignore', 'pipe', 'pipe'], 
    shell: true 
  });

  // Listener untuk log normal (stdout)
  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data); // Tampilkan log seperti biasa
    
    const text = data.toString();
    // Jika mendeteksi nodemon restart ATAU server selesai dinyalakan
    if (text.includes('[nodemon] starting') || text.includes('Server jalan di')) {
      // Beri jeda sedikit agar semua log selesai dicetak
      setTimeout(() => {
        if (isServerRunning) {
          process.stdout.write('\r\x1b[K'); // Bersihkan baris saat ini
          tampilkanMenu();
        }
      }, 300);
    }
  });

  // Listener untuk error (stderr)
  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  serverProcess.on('close', (code) => {
    isServerRunning = false;
    serverProcess = null;
    console.log(`\n🛑 Server berhenti dengan kode: ${code}`);
    tampilkanMenu();
  });
}

function stopServer() {
  if (!isServerRunning || !serverProcess) {
    console.log('⚠️ Server sedang tidak berjalan.');
    return tampilkanMenu();
  }

  console.log('🛑 Mematikan server...');
  if (process.platform === 'win32') {
    exec(`taskkill /pid ${serverProcess.pid} /T /F`, () => {
      isServerRunning = false;
      serverProcess = null;
      tampilkanMenu();
    });
  } else {
    serverProcess.kill('SIGINT');
    isServerRunning = false;
    serverProcess = null;
    tampilkanMenu();
  }
}

function backupDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('❌ File database tidak ditemukan!');
      return tampilkanMenu();
    }
    const timestamp = Date.now();
    const backupPath = path.join(__dirname, '..', 'database', `perpus.db.bak-${timestamp}`);
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`✅ Backup berhasil: database/perpus.db.bak-${timestamp}`);
  } catch (err) {
    console.log('❌ Gagal backup:', err.message);
  }
  tampilkanMenu();
}

function jalankanSkrip(scriptPath) {
  console.log(`🔄 Menjalankan ${scriptPath}...`);
  const child = spawn('node', [scriptPath], { stdio: 'inherit' });
  child.on('close', () => {
    tampilkanMenu();
  });
}

rl.on('line', (line) => {
  const input = line.trim();
  
  if (input === '') {
    return tampilkanMenu();
  }

  switch (input) {
    case '1': startServer(); break;
    case '2': stopServer(); break;
    case '3': backupDB(); break;
    case '4': jalankanSkrip('scripts/sync-sidebar.js'); break;
    case '5': jalankanSkrip('scripts/ganti-emoji-ke-svg.js'); break;
    case '6': jalankanSkrip('scripts/test-db.js'); break;
    case '7': jalankanSkrip('scripts/test-otomatis.js'); break;
    case '8':
      if (isServerRunning) {
        console.log('⚠️ Matikan server terlebih dahulu sebelum keluar (Ketik 2).');
        return tampilkanMenu();
      }
      console.log('👋 Keluar dari menu. Sampai jumpa!');
      process.exit(0);
      break;
    default:
      console.log('❌ Pilihan tidak valid.');
      tampilkanMenu();
      break;
  }
});

// Mulai aplikasi
console.clear();
console.log('Memuat Terminal Manager...');
setTimeout(tampilkanMenu, 500);
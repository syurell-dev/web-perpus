// ================================================================
// scripts/add-pengingat-domain.js
// Suntikkan CSS & JS Pengingat Domain ke semua file HTML
// (Kecuali login.html)
// ================================================================
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// File yang dikecualikan
const EXCLUDE_FILES = ['login.html'];

// Tag yang akan disuntikkan
const CSS_TAG = '<link rel="stylesheet" href="/css/pengingat.css">';
const JS_TAG  = '<script src="/js/pengingat-domain.js"></script>';

function run() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error('❌ Folder public tidak ditemukan di:', PUBLIC_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html'));
  let updatedCount = 0;
  let skippedCount = 0;

  console.log('🚀 Memulai injeksi Pengingat Domain...\n');

  files.forEach(file => {
    if (EXCLUDE_FILES.includes(file)) {
      console.log(`⏭️  Skip: ${file} (dikecualikan)`);
      return;
    }

    const filePath = path.join(PUBLIC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // ---------------------------------------------------------
    // 1. Suntikkan CSS
    // ---------------------------------------------------------
    if (!content.includes(CSS_TAG)) {
      // Coba sisipkan setelah theme.css
      const themeCssTag = '<link rel="stylesheet" href="/css/theme.css">';
      if (content.includes(themeCssTag)) {
        content = content.replace(themeCssTag, `${themeCssTag}\n  ${CSS_TAG}`);
        changed = true;
      } else {
        // Fallback: sisipkan sebelum </head>
        content = content.replace('</head>', `  ${CSS_TAG}\n</head>`);
        changed = true;
      }
    }

    // ---------------------------------------------------------
    // 2. Suntikkan JS
    // ---------------------------------------------------------
    if (!content.includes(JS_TAG)) {
      // Sisipkan sebelum </body>
      content = content.replace('</body>', `  ${JS_TAG}\n</body>`);
      changed = true;
    }

    // ---------------------------------------------------------
    // 3. Simpan jika ada perubahan
    // ---------------------------------------------------------
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${file}`);
      updatedCount++;
    } else {
      console.log(`⏭️  Skip: ${file} (sudah terpasang)`);
      skippedCount++;
    }
  });

  console.log('\n====================================');
  console.log(`🎉 Selesai!`);
  console.log(`✅ Diperbarui: ${updatedCount} file`);
  console.log(`⏭️  Dilewati  : ${skippedCount} file`);
  console.log('====================================');
}

run();
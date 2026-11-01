const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const JS_DIR = path.join(PUBLIC_DIR, 'js');

// Kamus pemetaan Emoji ke Ikon Lucide
const emojiMap = {
  '🏠': 'home',
  '📖': 'book',
  '👥': 'users',
  '🔄': 'refresh-cw',
  '📊': 'bar-chart-2',
  '⚙️': 'settings',
  '⚠️': 'alert-triangle',
  '💾': 'save',
  '📚': 'book-open',
  '📥': 'download',
  '📤': 'upload',
  '🔍': 'search',
  '🗑️': 'trash-2',
  '👁️': 'eye',
  'ℹ️': 'info',
  '🥇': 'award',
  '🥈': 'award',
  '🥉': 'award',
  '🔐': 'lock',
  '📦': 'package',
  '📁': 'folder',
  '🎫': 'credit-card',
  '🏷️': 'tag',
  '⏳': 'loader',
  '❌': 'x-circle',
  '✅': 'check-circle',
  '📭': 'inbox',
  '💡': 'lightbulb',
  '🚨': 'alert-octagon',
  '✏️': 'edit-2',
  '⬇️': 'arrow-down',
  '⬆️': 'arrow-up',
  '📋': 'clipboard-list',
  '🔙': 'arrow-left'
};

// Fungsi untuk mengganti emoji dengan tag <i data-lucide>
function replaceEmoji(content) {
  let newContent = content;
  for (const [emoji, iconName] of Object.entries(emojiMap)) {
    // Regex untuk mencari emoji (termasuk variasi dengan spasi)
    const regex = new RegExp(emoji, 'g');
    // Ganti dengan tag <i> standar
    newContent = newContent.replace(regex, `<i data-lucide="${iconName}"></i>`);
  }
  return newContent;
}

// 1. Proses semua file HTML di public
const htmlFiles = fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html'));
htmlFiles.forEach(file => {
  const filePath = path.join(PUBLIC_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let updatedContent = replaceEmoji(content);

  if (updatedContent !== content) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`✅ HTML Diperbarui: ${file}`);
  }
});

// 2. Proses semua file JS di public/js
if (fs.existsSync(JS_DIR)) {
  const jsFiles = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
  jsFiles.forEach(file => {
    const filePath = path.join(JS_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let updatedContent = replaceEmoji(content);

    if (updatedContent !== content) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✅ JS Diperbarui: ${file}`);
    }
  });
}

console.log('\n🎉 Selesai! Semua emoji telah diganti menjadi tag <i data-lucide>.');
console.log('Silakan restart server dan lakukan Hard Refresh (Ctrl+Shift+R).');
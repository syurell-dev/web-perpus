const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const JS_DIR = path.join(PUBLIC_DIR, 'js');

const emojiMap = {
  '🕐': '<i data-lucide="clock" class="w-4 h-4"></i>',
  '⏱️': '<i data-lucide="timer" class="w-4 h-4"></i>',
  '⏰': '<i data-lucide="alarm-clock" class="w-4 h-4"></i>',
  '➡️': '<i data-lucide="arrow-right" class="w-4 h-4"></i>',
  '←': '<i data-lucide="arrow-left" class="w-4 h-4"></i>',
  '📥': '<i data-lucide="download" class="w-4 h-4"></i>',
  '📤': '<i data-lucide="upload" class="w-4 h-4"></i>',
  '🔍': '<i data-lucide="search" class="w-4 h-4"></i>',
  '⚠️': '<i data-lucide="alert-triangle" class="w-4 h-4"></i>',
  '✅': '<i data-lucide="check-circle" class="w-4 h-4"></i>',
  '❌': '<i data-lucide="x-circle" class="w-4 h-4"></i>',
  '💡': '<i data-lucide="lightbulb" class="w-4 h-4"></i>',
  '📚': '<i data-lucide="library" class="w-4 h-4"></i>',
  '📖': '<i data-lucide="book-open" class="w-4 h-4"></i>',
  '📊': '<i data-lucide="bar-chart-2" class="w-4 h-4"></i>',
  '👥': '<i data-lucide="users" class="w-4 h-4"></i>',
  '🔄': '<i data-lucide="refresh-cw" class="w-4 h-4"></i>',
  '⚙️': '<i data-lucide="settings" class="w-4 h-4"></i>',
  '🏠': '<i data-lucide="home" class="w-4 h-4"></i>',
  '📋': '<i data-lucide="clipboard-list" class="w-4 h-4"></i>',
  '📈': '<i data-lucide="trending-up" class="w-4 h-4"></i>',
  '🏆': '<i data-lucide="trophy" class="w-4 h-4"></i>',
  '🗑️': '<i data-lucide="trash-2" class="w-4 h-4"></i>',
  '✏️': '<i data-lucide="edit" class="w-4 h-4"></i>',
  '🔑': '<i data-lucide="key" class="w-4 h-4"></i>',
  '🚨': '<i data-lucide="alert-octagon" class="w-4 h-4"></i>',
  '💾': '<i data-lucide="save" class="w-4 h-4"></i>',
  '⏳': '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i>',
  '📭': '<i data-lucide="inbox" class="w-4 h-4"></i>',
  '📦': '<i data-lucide="package" class="w-4 h-4"></i>',
  '🔐': '<i data-lucide="lock" class="w-4 h-4"></i>',
  '🎫': '<i data-lucide="credit-card" class="w-4 h-4"></i>',
  '🏷️': '<i data-lucide="tag" class="w-4 h-4"></i>',
  '💻': '<i data-lucide="laptop" class="w-4 h-4"></i>',
  '🖨️': '<i data-lucide="printer" class="w-4 h-4"></i>'
};

function replaceEmoji(content) {
  let newContent = content;
  for (const [emoji, iconTag] of Object.entries(emojiMap)) {
    const regex = new RegExp(emoji, 'g');
    newContent = newContent.replace(regex, iconTag);
  }
  return newContent;
}

let totalChanged = 0;

// 1. Process HTML files
fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html')).forEach(file => {
  const filePath = path.join(PUBLIC_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = replaceEmoji(content);

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✅ HTML: ${file}`);
    totalChanged++;
  }
});

// 2. Process JS files
if (fs.existsSync(JS_DIR)) {
  fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).forEach(file => {
    const filePath = path.join(JS_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = replaceEmoji(content);

    if (updated !== content) {
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log(`✅ JS: ${file}`);
      totalChanged++;
    }
  });
}

console.log(`\n🎉 Selesai! ${totalChanged} file berhasil dibersihkan.`);
console.log('Silakan restart server & Hard Refresh browser (Ctrl+Shift+R).');
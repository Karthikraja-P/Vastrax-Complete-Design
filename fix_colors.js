const fs = require('fs');
const path = './src/app/storefront/collections/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Container backgrounds
content = content.replace(/bg-\[#111111\]/g, 'bg-surface dark:bg-[#111111]');
content = content.replace(/bg-\[#161616\]/g, 'bg-background dark:bg-[#161616]');
content = content.replace(/bg-\[#1a1a1a\]/g, 'bg-surface dark:bg-[#1a1a1a]');
content = content.replace(/bg-\[#1c1c1c\]/g, 'bg-surface dark:bg-[#1c1c1c]');
content = content.replace(/bg-\[#222\]/g, 'bg-surface dark:bg-[#222]');
content = content.replace(/bg-\[#2a2a2a\]/g, 'bg-background dark:bg-[#2a2a2a]');

// Borders
content = content.replace(/border-white\/5/g, 'border-border/50 dark:border-white/5');
content = content.replace(/border-white\/10/g, 'border-border dark:border-white/10');
content = content.replace(/border-white\/20/g, 'border-border dark:border-white/20');

// Text colors (careful with plain text-white inside buttons, so we use regex with lookaround or specific context if needed, but let's just do a generic text-white replacement and revert for specific buttons if needed)
// Actually, to be safe, let's just replace text-white/40, text-white/50, text-white/60, text-white/70, text-white/90
content = content.replace(/text-white\/40/g, 'text-muted-foreground');
content = content.replace(/text-white\/50/g, 'text-muted-foreground');
content = content.replace(/text-white\/60/g, 'text-muted-foreground');
content = content.replace(/text-white\/70/g, 'text-muted-foreground');
content = content.replace(/text-white\/90/g, 'text-foreground/90');
// text-white -> text-foreground dark:text-white
// Wait, text-white is used for active state text and primary buttons.
// Let's replace 'text-white' with 'text-foreground dark:text-white' but avoid doing it inside bg-[#e07a3f]
// Instead of a blind text-white replacement, let's leave text-white alone as it might be fine on dark elements, OR do a more targeted replace.
content = content.replace(/text-white(?!\/)/g, 'text-foreground dark:text-white');
// Fix primary buttons which should remain text-white
content = content.replace(/text-foreground dark:text-white px-6/g, 'text-white px-6');
content = content.replace(/text-foreground dark:text-white text-sm font-bold flex/g, 'text-white text-sm font-bold flex');
content = content.replace(/text-foreground dark:text-white relative overflow-hidden/g, 'text-white relative overflow-hidden');

fs.writeFileSync(path, content, 'utf8');
console.log('Done');

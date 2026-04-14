const fs = require('fs');
const path = require('path');

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, filesList);
    } else {
      if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
        filesList.push(fullPath);
      }
    }
  }
  return filesList;
}

function fixFiles() {
  const files = getFiles('c:/optiplan360_project/frontend/src');
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const oldContent = content;

    // fix .DEFAULT anywhere it's used with COLORS
    content = content.replace(/COLORS\.([a-zA-Z]+)\.DEFAULT/g, 'COLORS.$1');
    
    // fix COLORS.panel
    content = content.replace(/COLORS\.panel/g, 'COLORS.bg.surface');

    // fix RADIUS.xl, RADIUS.xs
    content = content.replace(/RADIUS\.xl/g, '"1rem"');
    content = content.replace(/RADIUS\.xs/g, '"0.25rem"');
    content = content.replace(/RADIUS\.full/g, '"9999px"');

    // Fix NestingVisualizer 'any' import
    if (file.includes('NestingVisualizer.tsx')) {
        content = content.replace(/import type \{ any \} from "\.\.\/\.\.\/types";\n?/g, '');
    }

    if (file.includes('PriorityBadge.tsx')) {
        content = content.replace(/RADIUS\.full/g, '"9999px"');
    }

    if (file.includes('AIChatbot.tsx') || file.includes('KanbanCard.tsx')) {
        content = content.replace(/RADIUS\.xl/g, '"1rem"');
        content = content.replace(/RADIUS\.xs/g, '"0.25rem"');
    }

    if (content !== oldContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Fixed:', file);
    }
  });

  console.log('TS fixes phase 2 applied.');
}

fixFiles();

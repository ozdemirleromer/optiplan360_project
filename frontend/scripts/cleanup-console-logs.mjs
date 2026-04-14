/**
 * Console Log Cleanup Script
 * Frontend'deki tüm console.log'ları production logger ile değiştirir
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendSrcPath = path.join(__dirname, '../src');

// Console log pattern'ları
const consolePatterns = [
  /console\.log\(/g,
  /console\.warn\(/g,
  /console\.error\(/g,
  /console\.debug\(/g,
  /console\.info\(/g
];

// Logger import ekle
const loggerImport = "import { logInfo as log, logWarn, logError, logApiCall } from '../utils/logger';";

function cleanConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Import'ı ekle (eğer yoksa)
    if (!content.includes('from \'../utils/logger\'') && !content.includes('from "../utils/logger"')) {
      // İlk import satırından sonra ekle
      const importRegex = /import.*from.*['"];?\s*\n/;
      const match = content.match(importRegex);
      if (match) {
        content = content.replace(match[0], match[0] + '\n' + loggerImport + '\n');
      }
    }
    
    // Console.log'ları değiştir
    let changes = 0;
    
    // console.log -> log
    content = content.replace(/console\.log\(/g, 'log(');
    changes += (originalContent.match(/console\.log\(/g) || []).length;
    
    // console.warn -> logWarn
    content = content.replace(/console\.warn\(/g, 'logWarn(');
    changes += (originalContent.match(/console\.warn\(/g) || []).length;
    
    // console.error -> logError
    content = content.replace(/console\.error\(/g, 'logError(');
    changes += (originalContent.match(/console\.error\(/g) || []).length;
    
    // console.debug -> log (debug level)
    content = content.replace(/console\.debug\(/g, 'log(');
    changes += (originalContent.match(/console\.debug\(/g) || []).length;
    
    // console.info -> log
    content = content.replace(/console\.info\(/g, 'log(');
    changes += (originalContent.match(/console\.info\(/g) || []).length;
    
    // Dosyayı yaz
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Cleaned ${filePath}: ${changes} console calls replaced`);
      return changes;
    }
    
    return 0;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return 0;
  }
}

function findTsFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Ana işlem
function main() {
  console.log('🧹 Starting console.log cleanup...\n');
  
  const tsFiles = findTsFiles(frontendSrcPath);
  console.log(`📁 Found ${tsFiles.length} TypeScript files`);
  
  let totalChanges = 0;
  let processedFiles = 0;
  
  for (const file of tsFiles) {
    const changes = cleanConsoleLogs(file);
    if (changes > 0) {
      totalChanges += changes;
      processedFiles++;
    }
  }
  
  console.log(`\n✨ Cleanup completed!`);
  console.log(`📊 Processed ${processedFiles} files`);
  console.log(`🔄 Replaced ${totalChanges} console calls`);
  console.log(`\n📝 Next steps:`);
  console.log(`1. Run 'npm run build' to check for any compilation errors`);
  console.log(`2. Test the application in development mode`);
  console.log(`3. Verify logging works in production build`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { cleanConsoleLogs, findTsFiles };

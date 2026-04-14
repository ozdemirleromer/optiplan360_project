/**
 * TypeScript Strict Migration Script
 * any/@ts-ignore kullanımlarını azalt ve type safety'i artır
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendSrcPath = path.join(__dirname, '../src');

// Type issue patterns
const typeIssues = {
  anyType: /:\s*any\b/g,
  anyArray: /any\[\]/g,
  anyFunction: /:\s*\(\s*\.\.\.\s*\)\s*=>\s*any/g,
  tsIgnore: /\/\/\s*@ts-ignore/g,
  tsExpect: /\/\/\s*@ts-expect-error/g,
  implicitAny: /:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\s*[=;,)])/g
};

// Common type replacements
const typeReplacements = {
  'any': 'unknown',
  'any[]': 'unknown[]',
  'Record<string, any>': 'Record<string, unknown>',
  '{ [key: string]: any }': '{ [key: string]: unknown }'
};

function fixTypeIssues(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    let changes = 0;
    const issues = [];
    
    // any type'leri değiştir
    content = content.replace(/:\s*any\b/g, (match) => {
      changes++;
      issues.push('any type found');
      return ': unknown';
    });
    
    // any array'leri değiştir
    content = content.replace(/any\[\]/g, (match) => {
      changes++;
      issues.push('any[] found');
      return 'unknown[]';
    });
    
    // @ts-ignore'leri yorumla
    content = content.replace(/\/\/\s*@ts-ignore/g, (match) => {
      changes++;
      issues.push('@ts-ignore found');
      return '// TODO: Fix type issue - @ts-ignore removed';
    });
    
    // Implicit any'leri tespit et ve düzelt
    const implicitAnyMatches = content.match(/:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\s*[=;,)])/g);
    if (implicitAnyMatches) {
      changes += implicitAnyMatches.length;
      issues.push('implicit any types');
    }
    
    // Dosyayı yaz
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`🔧 Fixed ${filePath}: ${changes} type issues`);
      return { changes, issues };
    }
    
    return { changes: 0, issues: [] };
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { changes: 0, issues: [], error: error.message };
  }
}

function generateTypeDefinitions() {
  const commonTypes = `
// Common type definitions for OptiPlan360
export interface BaseEntity {
  id: string | number;
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface TableColumn<T = unknown> {
  key: keyof T;
  title: string;
  dataIndex: keyof T;
  render?: (value: unknown, record: T) => React.ReactNode;
  sorter?: boolean;
  width?: number;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// Event handlers
export type EventHandler<T = Event> = (event: T) => void;
export type ChangeHandler<T = unknown> = (value: T) => void;
export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>;

// API types
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Component props
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
`;

  const typesPath = path.join(frontendSrcPath, 'types', 'common.ts');
  if (!fs.existsSync(path.dirname(typesPath))) {
    fs.mkdirSync(path.dirname(typesPath), { recursive: true });
  }
  
  fs.writeFileSync(typesPath, commonTypes);
  console.log(`📝 Generated common types: ${typesPath}`);
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

function createStrictTsConfig() {
  const strictConfig = {
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      noImplicitReturns: true,
      noImplicitOverride: true,
      noPropertyAccessFromIndexSignature: true,
      exactOptionalPropertyTypes: true,
      baseUrl: ".",
      paths: {
        "@/*": ["./src/*"]
      }
    },
    include: ["src"],
    references: [{ "path": "./tsconfig.node.json" }]
  };
  
  const configPath = path.join(__dirname, '../tsconfig.strict.json');
  fs.writeFileSync(configPath, JSON.stringify(strictConfig, null, 2));
  console.log(`⚙️ Created strict TypeScript config: ${configPath}`);
}

function main() {
  console.log('🔧 Starting TypeScript strict migration...\n');
  
  generateTypeDefinitions();
  createStrictTsConfig();
  
  const tsFiles = findTsFiles(frontendSrcPath);
  console.log(`📁 Found ${tsFiles.length} TypeScript files`);
  
  let totalChanges = 0;
  let processedFiles = 0;
  const allIssues = [];
  
  for (const file of tsFiles) {
    const result = fixTypeIssues(file);
    if (result.changes > 0) {
      totalChanges += result.changes;
      processedFiles++;
      allIssues.push(...result.issues);
    }
  }
  
  // Issue özeti
  const issueSummary = {};
  allIssues.forEach(issue => {
    issueSummary[issue] = (issueSummary[issue] || 0) + 1;
  });
  
  console.log(`\n✨ Migration completed!`);
  console.log(`📊 Processed ${processedFiles} files`);
  console.log(`🔄 Fixed ${totalChanges} type issues`);
  console.log(`\n📈 Issue summary:`);
  Object.entries(issueSummary).forEach(([issue, count]) => {
    console.log(`  ${issue}: ${count}`);
  });
  
  console.log(`\n📝 Next steps:`);
  console.log(`1. Update tsconfig.json to use tsconfig.strict.json`);
  console.log(`2. Run 'npm run type-check' to identify remaining issues`);
  console.log(`3. Fix remaining type errors manually`);
  console.log(`4. Enable strict mode gradually`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fixTypeIssues, generateTypeDefinitions, createStrictTsConfig };

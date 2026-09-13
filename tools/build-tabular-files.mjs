import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = path.join(root, 'app/application');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-data-assets-'));
try {
  for (const name of fs.readdirSync(app)) {
    if (name.endsWith('.json'))
      fs.copyFileSync(path.join(app, name), path.join(temp, name));
    if (name.endsWith('.ts'))
      fs.writeFileSync(
        path.join(temp, name.replace(/\.ts$/, '.js')),
        ts.transpileModule(fs.readFileSync(path.join(app, name), 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        }).outputText,
      );
  }
  const require = createRequire(path.join(temp, 'assets.cjs'));
  const { initialDatasets, csvExport } = require('./model.js');
  const { getDataTables } = require('./data-resources.js');
  const { dataFiles } = require('./data-files.js');
  const tables = getDataTables({ datasets: initialDatasets });
  for (const file of dataFiles) {
    const table = tables.find((item) => item.id === file.tableId);
    if (!table) throw new Error(`Missing source table: ${file.tableId}`);
    const target = path.join(root, 'public', file.url);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '\ufeff' + csvExport(table.columns, table.rows));
    process.stdout.write(`${file.name}: ${table.rows.length} rows\n`);
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

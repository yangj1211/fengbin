import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
export function withApplication(check) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-final-'));
  try {
    for (const file of fs.readdirSync('app/application')) {
      if (file.endsWith('.json'))
        fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
      if (file.endsWith('.ts'))
        fs.writeFileSync(
          path.join(temp, file.replace(/\.ts$/, '.js')),
          ts.transpileModule(
            fs.readFileSync(`app/application/${file}`, 'utf8'),
            {
              compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
                esModuleInterop: true,
              },
            },
          ).outputText,
        );
    }
    check(createRequire(path.join(temp, 'test.cjs')));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

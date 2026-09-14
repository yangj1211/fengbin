import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-resources-test-'));
try {
  for (const file of fs.readdirSync('app/application')) {
    if (file.endsWith('.json'))
      fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
    if (file.endsWith('.ts'))
      fs.writeFileSync(
        path.join(temp, file.replace(/\.ts$/, '.js')),
        ts.transpileModule(fs.readFileSync(`app/application/${file}`, 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        }).outputText,
      );
  }
  const require = createRequire(path.join(temp, 'check.cjs'));
  const { modules, initialDatasets, csvExport } = require('./model.js');
  const {
    getDataTables,
    isDataResourceDeleted,
  } = require('./data-resources.js');
  const { sourceDocuments, documentsFor, findSourceDocument, resolveSource } = require('./knowledge-sources.js');
  const {
    dataFiles,
    datasetReference,
    findDataFile,
  } = require('./data-files.js');
  const { presentAnswer } = require('./business-presentation.js');
  const state = { datasets: initialDatasets };
  const tables = getDataTables(state);
  for (const agent of modules) {
    assert.ok(tables.some((item) => item.module === agent.id), agent.id);
  }
  for (const agent of ['customer', 'maintenance']) {
    assert.ok(documentsFor(agent).length, `${agent} source library remains available`);
  }
  for (const doc of sourceDocuments) {
    assert.doesNotMatch(JSON.stringify(doc), /样例|示例|演示|虚构|合成/);
    assert.ok(fs.existsSync('public' + doc.url));
    for (const page of doc.pages)
      assert.ok(fs.existsSync('public' + page.image));
  }
  for (const file of dataFiles) {
    const table = tables.find((item) => item.id === file.tableId);
    assert.ok(table, `${file.name} remains available for citation previews`);
    assert.equal(
      fs.readFileSync('public' + file.url, 'utf8').replace(/^\ufeff/, ''),
      csvExport(table.columns, table.rows),
    );
    assert.equal(findDataFile(encodeURI(file.url)), file);
  }
  assert.equal(
    tables.find((item) => item.id === 'energy-details').rows
      .length,
    84,
  );
  assert.equal(
    tables.find((item) => item.id === 'production').rows.length,
    4,
  );
  assert.equal(
    tables.find((item) => item.id === 'suppliers').rows.length,
    3,
  );
  // Existing browser markers still govern source previews after the management UI is removed.
  const reference = { documentId: 'catalog', sectionId: 'catalog-fb-lh470', page: 1 };
  const history = [{ question: '原始问题', sources: [reference] }];
  const deletedPdf = { ...state, sessions: history, deletedDataResourceIds: ['file:catalog'] };
  assert.equal(isDataResourceDeleted(deletedPdf, 'file:catalog'), true);
  assert.equal(isDataResourceDeleted(deletedPdf, 'file:rules'), false);
  assert.equal(isDataResourceDeleted(state, 'file:catalog'), false);
  assert.deepEqual(deletedPdf.sessions, history, 'Reading legacy markers retains historical answers and citation IDs');
  assert.ok(resolveSource(reference), 'Static reference validation must still preserve deleted references on hydration');
  const onlyTableDeleted = { ...state, deletedDataResourceIds: ['table:production'] };
  assert.equal(isDataResourceDeleted(onlyTableDeleted, 'file:production'), false);
  assert.ok(getDataTables(onlyTableDeleted).some(item => item.id === 'production'));
  assert.equal(findSourceDocument('/data/customer/产品目录.pdf#page=2').id, 'catalog');
  assert.equal(findSourceDocument(encodeURI('/sample-data/customer/示例产品目录.pdf') + '?v=1#page=2').id, 'catalog');
  assert.equal(findSourceDocument('/data/customer/%ZZ.pdf'), undefined);
  const oldEnergy = findDataFile('/sample-data/energy/示例用电明细.csv?download=1#page=1');
  assert.equal(isDataResourceDeleted({ ...state, deletedDataResourceIds: ['file:energy-details'] }, `file:${oldEnergy.tableId}`), true);
  const local = {
    ...initialDatasets.find((item) => item.id === 'production'),
    origin: 'local',
    fileName: '工厂报表.csv',
  };
  assert.equal(datasetReference(local, ''), '工厂报表.csv');
  assert.deepEqual(getDataTables({ datasets: [local] })[0].rows, local.rows.map(row => local.columns.map(column => row[column])));
  const historical = {
    question: '样例客户甲要求 450V',
    inputs: { voltage: '450' },
    answer:
      '样例交期 14 天，仅用于演示交期比较。\n\n参考数据：[示例用电明细.csv](/sample-data/energy/示例用电明细.csv)',
    sourceName: '示例产品目录.pdf',
  };
  const before = JSON.stringify(historical);
  const visible = presentAnswer(historical);
  assert.equal(visible.question, historical.question);
  assert.deepEqual(visible.inputs, historical.inputs);
  assert.match(visible.answer, /目录参考交期 14 天/);
  assert.match(
    visible.answer,
    /\[用电明细.csv\]\(\/sample-data\/energy\/示例用电明细.csv\)/,
  );
  assert.equal(JSON.stringify(historical), before);
  console.log(
    'Source preview tests passed: all five agents, matching CSV records, PDF assets, legacy markers and historical display.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

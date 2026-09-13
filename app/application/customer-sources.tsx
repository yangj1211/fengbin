'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SourcePreviewPanel from './source-preview-panel';
import {
  sourceDocuments,
  documentsFor,
  resolveSource,
  uniqueSources,
} from './knowledge-sources';
import type { CustomerFixtures, SourceReference } from './customer-types';
import BackButton from './back-button';
import { useWorkspace } from './store';
import { isDataResourceDeleted } from './data-resources';

function OriginalPage({
  document,
  page,
}: {
  document: CustomerFixtures['documents'][number];
  page: number;
}) {
  const [failed, setFailed] = useState(false);
  const preview = document.pages.find((item) => item.page === page);
  return (
    <section
      className="source-page-viewport"
      tabIndex={0}
      aria-label={`${document.fileName}，第 ${page} 页原文`}
    >
      {preview && !failed ? (
        <>
          <img
            className="source-page-image"
            src={preview.image}
            width={preview.width}
            height={preview.height}
            alt={`${document.fileName}，第 ${page} 页`}
            onError={() => setFailed(true)}
          />
          <div className="sr-only">
            {document.sections
              .filter((section) => section.page === page)
              .map((section) => (
                <section key={section.id}>
                  <h3>{section.title}</h3>
                  <p>{section.text}</p>
                </section>
              ))}
          </div>
        </>
      ) : (
        <div className="source-page-error">
          <p>这一页暂时无法显示。</p>
          <a
            href={`${encodeURI(document.url)}#page=${page}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            查看原文件
          </a>
        </div>
      )}
    </section>
  );
}

export function SourceDrawer({
  selected,
  library,
  module = 'customer',
  onClose,
  onSelect,
}: {
  selected: SourceReference | null;
  library?: boolean;
  module?: 'customer' | 'maintenance';
  onClose: () => void;
  onSelect: (ref: SourceReference | null) => void;
}) {
  const state = useWorkspace();
  const resolved = selected ? resolveSource(selected) : null;
  const deleted = Boolean(
    selected && isDataResourceDeleted(state, `file:${selected.documentId}`),
  );
  const availableDocuments = documentsFor(module).filter(
    (document) => !isDataResourceDeleted(state, `file:${document.id}`),
  );
  const pages = resolved?.document.pages ?? [];
  const pageIndex = pages.findIndex((page) => page.page === selected?.page);
  function changePage(page: number) {
    const section = resolved?.document.sections.find(
      (item) => item.page === page,
    );
    if (resolved && section)
      onSelect({
        documentId: resolved.document.id,
        sectionId: section.id,
        page,
      });
  }
  return (
    <SourcePreviewPanel
      open={Boolean(selected) || Boolean(library)}
      title={resolved ? resolved.document.fileName : '业务资料'}
      description="业务资料。打开后定位到引用页，可切换页码查看原文。"
      hideDescription={Boolean(resolved)}
      className={`customer-source-sheet${resolved ? ' is-reading' : ''}`}
      onClose={onClose}
    >
      {deleted ? (
        <div className="source-sheet-body">
          <p className="source-unavailable">文件已删除，无法查看原文。</p>
        </div>
      ) : resolved ? (
        <>
          <div className="source-page-toolbar">
            {library && (
              <BackButton
                destination="资料列表"
                onClick={() => onSelect(null)}
              />
            )}
            <nav className="source-page-controls" aria-label="原文件翻页">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="上一页"
                title="上一页"
                disabled={pageIndex <= 0}
                onClick={() => {
                  if (pageIndex > 0) changePage(pages[pageIndex - 1].page);
                }}
              >
                <ChevronLeft size={17} />
              </Button>
              <Select
                value={selected!.page}
                items={pages.map((item) => ({
                  value: item.page,
                  label: `第 ${item.page} 页`,
                }))}
                onValueChange={(page) => {
                  if (page !== null) changePage(page);
                }}
                disabled={pages.length < 2}
              >
                <SelectTrigger aria-label="切换页码">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {pages.map((item) => (
                    <SelectItem key={item.page} value={item.page}>
                      第 {item.page} 页
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="source-page-total">共 {pages.length} 页</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="下一页"
                title="下一页"
                disabled={pageIndex < 0 || pageIndex >= pages.length - 1}
                onClick={() => {
                  if (pageIndex < pages.length - 1)
                    changePage(pages[pageIndex + 1].page);
                }}
              >
                <ChevronRight size={17} />
              </Button>
            </nav>
          </div>
          <OriginalPage
            key={`${resolved.document.id}-${selected!.page}`}
            document={resolved.document}
            page={selected!.page}
          />
        </>
      ) : (
        <div className="source-sheet-body">
          <div className="source-library-list">
            {availableDocuments.map((document) => (
              <button
                key={document.id}
                onClick={() =>
                  onSelect({
                    documentId: document.id,
                    sectionId: document.sections[0].id,
                    page: document.sections[0].page,
                  })
                }
              >
                <FileText size={21} />
                <span>
                  <strong>{document.fileName}</strong>
                  <small>{document.summary}</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
            {!availableDocuments.length && (
              <p className="source-unavailable">暂无可用的业务资料。</p>
            )}
          </div>
        </div>
      )}
    </SourcePreviewPanel>
  );
}

export function AnswerSources({
  sources,
  legacy = false,
}: {
  sources?: SourceReference[];
  legacy?: boolean;
}) {
  const state = useWorkspace();
  const [selected, setSelected] = useState<SourceReference | null>(null);
  const valid = uniqueSources(sources ?? []).filter((source) =>
    resolveSource(source),
  );
  const groups = sourceDocuments.flatMap((document) => {
    const refs = valid.filter((ref) => ref.documentId === document.id);
    return refs.length ? [{ document, refs }] : [];
  });
  if (!groups.length)
    return (
      <p className="source-unavailable">
        {legacy
          ? '这条历史回答尚未记录原文件引用，请重新提问查看最新依据。'
          : '这条回答没有可核对的文件依据，请补充需求后再试。'}
      </p>
    );
  return (
    <section className="answer-source-section" aria-label="回答引用的原文件">
      <p className="answer-source-heading">参考资料</p>
      <ol className="answer-source-files">
        {groups.map(({ document, refs }) => {
          const label = `${document.fileName}（第 ${Array.from(
            new Set(refs.map((ref) => ref.page)),
          )
            .sort((a, b) => a - b)
            .join('、')} 页）`;
          return (
            <li key={document.id}>
              {isDataResourceDeleted(state, `file:${document.id}`) ? (
                <span className="source-reference-deleted">
                  {label}（文件已删除）
                </span>
              ) : (
                <button
                  onClick={() => setSelected(refs[0])}
                  title={document.fileName}
                >
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <SourceDrawer
        selected={selected}
        onSelect={setSelected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

export function SourceLibrary({
  module,
}: {
  module: 'customer' | 'maintenance';
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SourceReference | null>(null);
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <BookOpen size={17} />
        <span>业务资料</span>
      </Button>
      <SourceDrawer
        library={open}
        module={module}
        selected={selected}
        onSelect={setSelected}
        onClose={() => {
          setOpen(false);
          setSelected(null);
        }}
      />
    </>
  );
}

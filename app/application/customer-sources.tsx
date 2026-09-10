'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  customerFixtures,
  resolveSource,
  uniqueSources,
} from './customer-data';
import type { SourceReference } from './customer-types';

function SourceDrawer({
  selected,
  library,
  onClose,
  onSelect,
}: {
  selected: SourceReference | null;
  library?: boolean;
  onClose: () => void;
  onSelect: (ref: SourceReference | null) => void;
}) {
  const resolved = selected ? resolveSource(selected) : null;
  return (
    <Sheet
      open={Boolean(selected) || Boolean(library)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="customer-source-sheet">
        <SheetHeader>
          <SheetTitle>
            {resolved ? resolved.document.fileName : '示例资料'}
          </SheetTitle>
          <SheetDescription>
            本场景专用示例资料，产品和参数均为虚构，仅用于演示。
          </SheetDescription>
        </SheetHeader>
        <div className="source-sheet-body">
          {resolved ? (
            <>
              {library && (
                <Button variant="ghost" onClick={() => onSelect(null)}>
                  <ArrowLeft size={15} />
                  全部资料
                </Button>
              )}
              <div className="source-location">
                <span>{resolved.document.kind}</span>
                <span>第 {resolved.section.page} 页</span>
              </div>
              <h3>{resolved.section.title}</h3>
              <p className="source-excerpt">{resolved.section.text}</p>
              <a
                className="source-original-link"
                href={`${encodeURI(resolved.document.url)}#page=${resolved.section.page}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText size={17} />
                打开原文件 PDF
                <ArrowUpRight size={16} />
              </a>
              <details className="source-sections">
                <summary>查看文件中的其他内容</summary>
                {resolved.document.sections.map((section) => (
                  <button
                    key={section.id}
                    className={
                      section.id === selected?.sectionId ? 'is-current' : ''
                    }
                    onClick={() =>
                      onSelect({
                        documentId: resolved.document.id,
                        sectionId: section.id,
                        page: section.page,
                      })
                    }
                  >
                    <span>{section.title}</span>
                    <small>第 {section.page} 页</small>
                  </button>
                ))}
              </details>
            </>
          ) : (
            <div className="source-library-list">
              {customerFixtures.documents.map((document) => (
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
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SourceLink({ source }: { source: SourceReference }) {
  const [selected, setSelected] = useState<SourceReference | null>(null);
  const resolved = resolveSource(source);
  if (!resolved) return null;
  return (
    <>
      <button
        className="source-inline-link"
        title={resolved.document.fileName}
        onClick={() => setSelected(source)}
      >
        <FileText size={14} />
        <span>{resolved.document.fileName}</span>
        <small>第 {source.page} 页</small>
      </button>
      <SourceDrawer
        selected={selected}
        onSelect={setSelected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

export function AnswerSources({
  sources,
  legacy = false,
}: {
  sources?: SourceReference[];
  legacy?: boolean;
}) {
  const [selected, setSelected] = useState<SourceReference | null>(null);
  const valid = uniqueSources(sources ?? []).filter((source) =>
    resolveSource(source),
  );
  const groups = customerFixtures.documents.flatMap((document) => {
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
      <div className="answer-source-heading">
        <BookOpen size={15} />
        <strong>引用原文件</strong>
        <span>{groups.length} 份 · 示例资料</span>
      </div>
      <div className="answer-source-files">
        {groups.map(({ document, refs }, i) => (
          <button
            key={document.id}
            onClick={() => setSelected(refs[0])}
            title={document.fileName}
          >
            <span className="source-index">{i + 1}</span>
            <FileText size={16} />
            <span className="source-file-name">{document.fileName}</span>
            <small>
              第 {Array.from(new Set(refs.map((r) => r.page))).join('、')} 页
            </small>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
      <SourceDrawer
        selected={selected}
        onSelect={setSelected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

export function CustomerSourceLibrary() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SourceReference | null>(null);
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <BookOpen size={17} />
        <span>示例资料</span>
      </Button>
      <SourceDrawer
        library={open}
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

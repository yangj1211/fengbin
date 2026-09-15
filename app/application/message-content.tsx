/* oxlint-disable nextjs/no-img-element -- Source photos use their unchanged original assets and dimensions. */
import Markdown from 'react-markdown';
import { useState } from 'react';
import { findDataFile, type DataFile } from './data-files';
import { getDataTables, isDataResourceDeleted } from './data-resources';
import { useWorkspace } from './store';
import { findSourceDocument } from './knowledge-sources';
import DataFilePreview from './data-file-preview';
import { SourceDrawer } from './customer-sources';
import type { SourceReference } from './customer-types';

/** Shared message renderer: content controls the structure, not a scene schema. */
export default function MessageContent({
  content,
  interactive = true,
}: {
  content: string;
  interactive?: boolean;
}) {
  const [file, setFile] = useState<DataFile | null>(null);
  const [imageSource, setImageSource] = useState<SourceReference | null>(null);
  const state = useWorkspace();
  const table = file
    ? getDataTables(state).find((item) => item.id === file.tableId)
    : undefined;
  return (
    <div className="message-markdown">
      <Markdown
        skipHtml
        components={{
          img: ({ src, alt }) => {
            const document = typeof src === 'string' ? findSourceDocument(src) : undefined;
            if (document?.kind !== 'image') return <img src={src} alt={alt ?? ''} />;
            if (isDataResourceDeleted(state, `file:${document.id}`)) return <span className="source-reference-deleted">{document.fileName}（文件已删除）</span>;
            const ref = { documentId: document.id, sectionId: document.sections[0].id, page: 1 };
            return <button type="button" className="maintenance-answer-image" aria-label={`查看${document.summary}原图`} disabled={!interactive} onClick={() => setImageSource(ref)}><img src={src} alt={alt || document.summary} width={document.pages[0].width} height={document.pages[0].height} /></button>;
          },
          a: ({ href, children }) => {
            if (!interactive) return <span>{children}</span>;
            const source = href ? findDataFile(href) : undefined;
            const document = href ? findSourceDocument(href) : undefined;
            const resourceId = source?.tableId ?? document?.id;
            if (
              resourceId &&
              isDataResourceDeleted(state, `file:${resourceId}`)
            )
              return (
                <span className="source-reference-deleted">
                  {source?.name ?? document?.fileName}（文件已删除）
                </span>
              );
            return (
              <a
                href={href}
                onClick={
                  source
                    ? (event) => {
                        event.preventDefault();
                        setFile(source);
                      }
                    : undefined
                }
              >
                {source?.sourceRow ? children : (source?.name ?? children)}
              </a>
            );
          },
        }}
      >
        {content}
      </Markdown>
      {file && (
        <DataFilePreview
          key={`${file.tableId}/${file.sourceRow}`}
          sourceRow={file.sourceRow}
          resourceKey={`file:${file.tableId}`}
          name={file.name}
          table={table}
          onClose={() => setFile(null)}
        />
      )}
      {imageSource && <SourceDrawer module="maintenance" selected={imageSource} onSelect={setImageSource} onClose={() => setImageSource(null)} />}
    </div>
  );
}

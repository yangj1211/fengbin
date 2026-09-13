import Markdown from 'react-markdown';
import { useState } from 'react';
import { findDataFile, type DataFile } from './data-files';
import { getDataTables, isDataResourceDeleted } from './data-resources';
import { useWorkspace } from './store';
import { findSourceDocument } from './knowledge-sources';
import DataFilePreview from './data-file-preview';

/** Shared message renderer: content controls the structure, not a scene schema. */
export default function MessageContent({
  content,
  interactive = true,
}: {
  content: string;
  interactive?: boolean;
}) {
  const [file, setFile] = useState<DataFile | null>(null);
  const state = useWorkspace();
  const table =
    file &&
    state.datasets.find((item) => item.id === file.datasetId)?.origin ===
      'sample'
      ? getDataTables(state).find((item) => item.id === file.tableId)
      : undefined;
  return (
    <div className="message-markdown">
      <Markdown
        skipHtml
        components={{
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
                {source?.name ?? children}
              </a>
            );
          },
        }}
      >
        {content}
      </Markdown>
      {file && (
        <DataFilePreview
          key={file.tableId}
          resourceKey={`file:${file.tableId}`}
          name={file.name}
          table={table}
          onClose={() => setFile(null)}
        />
      )}
    </div>
  );
}

import Markdown from 'react-markdown';

/** Shared message renderer: content controls the structure, not a scene schema. */
export default function MessageContent({ content }: { content: string }) {
  return (
    <div className="message-markdown">
      <Markdown skipHtml>{content}</Markdown>
    </div>
  );
}

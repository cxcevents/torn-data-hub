import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Heading3, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { marked } from "marked";

// ChatGPT (and many editors) put Markdown on the clipboard as plain text.
// Detect it so pasted tables, headings, bold, and lists become real formatting.
function looksLikeMarkdown(text: string): boolean {
  return (
    /^\s*\|.+\|\s*$/m.test(text) || // | table | rows |
    /^\s*#{1,6}\s+\S/m.test(text) || // # headings
    /\*\*[^*\n]+\*\*/.test(text) || // **bold**
    /^\s*[-*]\s+\S/m.test(text) || // - bullets
    /^\s*\d+\.\s+\S/m.test(text) // 1. numbered lists
  );
}

function markdownToHtml(text: string): string {
  return marked.parse(text, { async: false, gfm: true, breaks: true }) as string;
}

interface Props {
  value: string; // HTML
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
}

function ToolbarButton({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editorRefHolder = useRef<ReturnType<typeof useEditor> | null>(null);
  const editor = useEditor({
    extensions: [
      // StarterKit already bundles underline and link in TipTap v3.
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }),
      // Table support so pasted tables (from forums, wiki, docs) keep their structure.
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value,
    editorProps: {
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData("text/html");
        const text = event.clipboardData?.getData("text/plain");
        // Only step in for plain-text pastes that look like Markdown.
        if (!html && text && looksLikeMarkdown(text)) {
          event.preventDefault();
          const converted = markdownToHtml(text);
          // Defer so we can use the editor instance from the outer scope.
          window.setTimeout(() => {
            editorRefHolder.current?.chain().focus().insertContent(converted).run();
          }, 0);
          return true;
        }
        return false;
      },
      attributes: {
        class: "guide-prose min-h-[300px] px-3 py-2 text-sm outline-none",
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
  });

  editorRefHolder.current = editor;

  // Sync external value into the editor exactly once when it changes from outside
  // (e.g. edit-mode prefill after async fetch).
  useEffect(() => {
    if (editor && value && editor.getHTML() !== value && editor.getText().trim() === "") {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="bg-card border border-border rounded-md focus-within:border-primary/60">
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1 flex-wrap">
        <ToolbarButton title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="w-4 h-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} data-testid="input-guide-body" />
    </div>
  );
}

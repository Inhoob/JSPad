import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorState } from '@codemirror/state';

interface EditorPanelProps {
  code: string;
  onChange: (code: string) => void;
  onScroll?: (scrollTop: number) => void;
}

export function EditorPanel({ code, onChange, onScroll }: EditorPanelProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onScrollRef = useRef(onScroll);

  // Keep refs up to date
  useEffect(() => {
    onChangeRef.current = onChange;
    onScrollRef.current = onScroll;
  }, [onChange, onScroll]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (viewRef.current && e.target === editorRef.current) {
      // Click was on the container, not on the editor content
      const doc = viewRef.current.state.doc;
      const lastPos = doc.length;

      viewRef.current.dispatch({
        selection: { anchor: lastPos, head: lastPos },
        scrollIntoView: true,
      });
      viewRef.current.focus();
    }
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        javascript(),
        vscodeDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.domEventHandlers({
          scroll: (_event, view) => {
            if (onScrollRef.current) {
              onScrollRef.current(view.scrollDOM.scrollTop);
            }
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Auto-focus when editor is mounted
    view.focus();

    return () => {
      view.destroy();
    };
  }, []);

  return (
    <div
      ref={editorRef}
      className="w-full h-full overflow-auto"
      style={{ fontSize: '14px' }}
      onClick={handleContainerClick}
    />
  );
}

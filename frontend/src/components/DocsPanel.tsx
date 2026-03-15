import React, { useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import Quill from "quill";
import { QuillBinding } from "y-quill";
import QuillCursors from "quill-cursors";
import "quill/dist/quill.snow.css";

// Register the cursor module for this component
Quill.register("modules/cursors", QuillCursors);

interface DocsPanelProps {
  yDoc: Y.Doc;
  provider: WebsocketProvider;
}

export default function DocsPanel({ yDoc, provider }: DocsPanelProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const quillInstanceRef = useRef<Quill | null>(null);
  const quillBindingRef = useRef<QuillBinding | null>(null);

  useEffect(() => {
    // Safety check: ensure the DOM wrapper exists and we haven't already initialized
    if (!wrapperRef.current || quillInstanceRef.current) return;

    // 1. Create a fresh DOM element for Quill
    const editorDiv = document.createElement("div");
    wrapperRef.current.append(editorDiv);

    // 2. Initialize the Quill Rich Text Editor
    quillInstanceRef.current = new Quill(editorDiv, {
      theme: "snow",
      modules: {
        cursors: true, // Activate the cursor module
        toolbar: [
          [{ header: [1, 2, false] }],
          ["bold", "italic", "underline"],
          ["code-block"]
        ]
      }
    });

    // 3. Bind Quill to the Yjs "docs" text type
    const yTextDocs = yDoc.getText("docs");
    quillBindingRef.current = new QuillBinding(
      yTextDocs, 
      quillInstanceRef.current, 
      provider.awareness
    );

    // 4. Cleanup
    return () => {
      if (quillBindingRef.current) {
        quillBindingRef.current.destroy();
        quillBindingRef.current = null;
      }
      quillInstanceRef.current = null;
      if (wrapperRef.current) {
        wrapperRef.current.innerHTML = "";
      }
    };
  }, [yDoc, provider]);

  return (
    <div style={{ flex: 1, backgroundColor: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* Panel Header */}
      <div style={{ 
        padding: "10px", 
        backgroundColor: "#f3f3f3", 
        borderBottom: "1px solid #ddd", 
        color: "#333", 
        fontWeight: "bold",
        flexShrink: 0 /* Prevents the header from squishing */
      }}>
        📄 Main Documentation
      </div>
      
      {/* Editor Container */}
      <div 
        ref={wrapperRef} 
        style={{ flex: 1, display: "flex", flexDirection: "column", color: "#000", overflowY: "auto" }} 
      />
    </div>
  );
}
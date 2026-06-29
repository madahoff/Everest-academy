"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Color from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import { Variable } from "lucide-react"

interface VariableRichTextEditorProps {
    content: string
    onChange: (html: string) => void
    variables: string[]
}

/**
 * Rich text editor with {variable} insertion buttons, used for personalized bulk emails.
 * `content` only seeds the editor on mount (Tiptap convention) — updates flow out via onChange.
 */
export function VariableRichTextEditor({ content, onChange, variables }: VariableRichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({ openOnClick: false }),
            TextStyle,
            Color,
        ],
        content,
        immediatelyRender: false,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4",
            },
        },
    })

    const insertVariable = (variable: string) => {
        editor?.chain().focus().insertContent(`{${variable}}`).run()
    }

    return (
        <div>
            {variables.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 border-b-0">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1 mr-2">
                        <Variable className="w-3 h-3" /> Variables :
                    </span>
                    {variables.map((variable) => (
                        <button
                            key={variable}
                            type="button"
                            onClick={() => insertVariable(variable)}
                            className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20 transition"
                        >
                            {`{${variable}}`}
                        </button>
                    ))}
                </div>
            )}

            {editor && (
                <div className="flex gap-1 p-2 bg-gray-50 border border-gray-200 border-b-0 border-t-0">
                    <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 text-xs font-bold hover:bg-white transition ${editor.isActive("bold") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>B</button>
                    <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 text-xs italic hover:bg-white transition ${editor.isActive("italic") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>I</button>
                    <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 text-xs underline hover:bg-white transition ${editor.isActive("underline") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>U</button>
                    <div className="w-px bg-gray-200 mx-1" />
                    <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 text-xs hover:bg-white transition ${editor.isActive("bulletList") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>• Liste</button>
                    <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 text-xs hover:bg-white transition ${editor.isActive("orderedList") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>1. Liste</button>
                </div>
            )}
            <div className="border border-gray-200 bg-white">
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}

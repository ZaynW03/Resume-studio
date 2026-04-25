import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import {
  Bold, Italic, Underline as UIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon,
} from 'lucide-react'
import { useEffect } from 'react'

function Btn({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        'p-1.5 rounded-lg transition-colors ' +
        (active
          ? 'bg-indigo-100 text-indigo-600'
          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700')
      }
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: { 'data-placeholder': placeholder || 'Start typing…' },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (!editor) return null

  const addLink = () => {
    const url = prompt('URL (leave empty to remove link)')
    if (url === null) return
    if (url === '') return editor.chain().focus().unsetLink().run()
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition-colors">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-1.5 py-1 bg-gray-50/80 rounded-t-lg">
        <Btn title="Bold"       active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={13}/></Btn>
        <Btn title="Italic"     active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={13}/></Btn>
        <Btn title="Underline"  active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UIcon size={13}/></Btn>
        <span className="w-px h-4 bg-gray-200 mx-0.5"/>
        <Btn title="Bullet list"   active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={13}/></Btn>
        <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={13}/></Btn>
        <span className="w-px h-4 bg-gray-200 mx-0.5"/>
        <Btn title="Align left"   active={editor.isActive({ textAlign: 'left' })}   onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={13}/></Btn>
        <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={13}/></Btn>
        <Btn title="Align right"  active={editor.isActive({ textAlign: 'right' })}  onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={13}/></Btn>
        <span className="w-px h-4 bg-gray-200 mx-0.5"/>
        <Btn title="Insert link" active={editor.isActive('link')} onClick={addLink}><LinkIcon size={13}/></Btn>
      </div>
      <EditorContent editor={editor}/>
    </div>
  )
}

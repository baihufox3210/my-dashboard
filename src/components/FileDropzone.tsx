import { useEffect, useId, useState } from 'react'

type FileDropzoneProps = {
  title: string
  hint?: string
  file?: File | null
  previewUrl?: string
  onFile: (file: File | null) => void
}

function FileDropzone({ title, hint = '點擊選取，或將圖片拖曳至此', file, previewUrl, onFile }: FileDropzoneProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [localPreview, setLocalPreview] = useState('')

  useEffect(() => {
    if (!file) { setLocalPreview(''); return }
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function acceptFiles(files: FileList | null) {
    const selected = files?.[0]
    if (selected?.type.startsWith('image/')) onFile(selected)
  }

  return <label
    className={`file-dropzone${dragging ? ' is-dragging' : ''}${file || previewUrl ? ' has-image' : ''}`}
    htmlFor={inputId}
    onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
    onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFiles(event.dataTransfer.files) }}
  >
    <input id={inputId} type="file" accept="image/*" onChange={(event) => { acceptFiles(event.target.files); event.currentTarget.value = '' }} />
    {(localPreview || previewUrl) ? <img src={localPreview || previewUrl} alt="" /> : <span className="file-dropzone-icon">↑</span>}
    <span className="file-dropzone-copy"><strong>{file?.name || title}</strong><small>{hint}</small></span>
  </label>
}

export default FileDropzone

import useEscapeKey from './useEscapeKey'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

function ConfirmDialog({ open, title, message, confirmLabel = '確認刪除', cancelLabel = '取消', busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  useEscapeKey(open, () => { if (!busy) onCancel() }, 100)

  if (!open) return null

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <div className="confirm-dialog-mark" aria-hidden="true">!</div>
        <div className="confirm-dialog-copy">
          <p className="confirm-dialog-kicker">PLEASE CONFIRM</p>
          <h2 id="confirm-dialog-title">{title}</h2>
          <p id="confirm-dialog-message">{message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="ui-button ui-button-danger" disabled={busy} onClick={() => void onConfirm()}>{busy ? '處理中…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}

export default ConfirmDialog

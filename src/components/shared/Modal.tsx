import { useEffect, useRef, type ReactNode } from 'react'

/** Native modal focus containment, Escape dismissal and focus restoration. */
export function Modal({ open, onClose, titleId, children, className = '', id }: {
  open: boolean; onClose: () => void; titleId: string; children: ReactNode; className?: string; id?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && dialog && !dialog.open) {
      previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    }
    if (!open && dialog?.open) {
      dialog.close()
      previouslyFocused.current?.focus()
      previouslyFocused.current = null
    }
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [open])
  return <dialog id={id} ref={ref} className={`app-dialog ${className}`} aria-labelledby={titleId} aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-content">{children}</div>
  </dialog>
}

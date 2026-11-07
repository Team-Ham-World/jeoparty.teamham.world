"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A native <dialog> shown with showModal(): the browser traps focus, closes
 * on Escape, and returns focus to the opener. `open` is controlled by the
 * parent; `onClose` runs for Escape, the backdrop, and close buttons.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // jsdom has no showModal; fall back to the open attribute.
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop targets the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
    >
      {open ? (
        <>
          <div className="dialog__head">
            <h2 id={titleId}>{title}</h2>
            {description ? (
              <p id={descId} className="muted" style={{ marginTop: "0.4rem" }}>
                {description}
              </p>
            ) : null}
          </div>
          {children ? <div className="dialog__body">{children}</div> : null}
          {footer ? <div className="dialog__foot">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

/** Yes/no confirmation. The safe choice ("Keep playing") gets focus first. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "bad",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "bad" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === "bad" ? "btn--bad" : "btn--primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

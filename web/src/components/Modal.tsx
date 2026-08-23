import type { FormEvent, ReactNode } from 'react';

interface ModalProps {
  title: string;
  error?: string | null;
  pending?: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}

/** Diálogo modal para las acciones SOAR (simular / bloquear / ticket). */
export default function Modal({
  title,
  error,
  pending = false,
  submitLabel,
  submitDisabled = false,
  onClose,
  onSubmit,
  children,
}: ModalProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="modal-title">{title}</h2>
        {error ? (
          <p className="modal-error" role="alert">
            {error}
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <fieldset disabled={pending} className="modal-fieldset">
            {children}
          </fieldset>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-accent"
              disabled={pending || submitDisabled}
            >
              {pending ? 'Enviando…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

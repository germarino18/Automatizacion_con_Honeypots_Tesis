interface EmptyStateProps {
  title: string;
  message?: string;
}

/** Estado vacío informativo (sin datos en el rango consultado). */
export default function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-title">{title}</span>
      {message ? <span>{message}</span> : null}
    </div>
  );
}

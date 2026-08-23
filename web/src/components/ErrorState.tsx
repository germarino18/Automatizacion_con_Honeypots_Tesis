interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

/** Estado de error con acción de reintento (refetch de react-query). */
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <span className="error-state-title">Error al cargar los datos</span>
      {message ? <span className="error-state-message">{message}</span> : null}
      <button type="button" className="error-state-retry" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

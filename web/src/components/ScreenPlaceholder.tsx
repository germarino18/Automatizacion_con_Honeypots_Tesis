interface ScreenPlaceholderProps {
  title: string;
  description: string;
}

export default function ScreenPlaceholder({
  title,
  description,
}: ScreenPlaceholderProps) {
  return (
    <section className="screen">
      <h1 className="screen-title">{title}</h1>
      <p className="screen-subtitle">{description}</p>
      <div className="card">
        <div className="empty-state">
          <span className="empty-state-title">Pantalla en construcción</span>
          <span>
            Esta vista se implementará al conectar sus datos de la API.
          </span>
        </div>
      </div>
    </section>
  );
}

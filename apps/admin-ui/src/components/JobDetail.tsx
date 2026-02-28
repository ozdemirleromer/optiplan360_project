import type { JobDetailResponse } from "../types";

interface JobDetailProps {
  detail: JobDetailResponse | null;
}

export function JobDetail({ detail }: JobDetailProps) {
  if (!detail) {
    return (
      <section className="panel" aria-live="polite">
        <h2>Job Detail</h2>
        <p>Detay secimi bekleniyor.</p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="job-detail-heading">
      <h2 id="job-detail-heading">Job Detail</h2>
      <div className="detail-grid">
        <div>
          <p><strong>ID:</strong> {detail.job.id}</p>
          <p><strong>Order:</strong> {detail.job.order_id}</p>
          <p><strong>State:</strong> {detail.job.state}</p>
          <p><strong>Error:</strong> {detail.job.error_code ?? "-"}</p>
        </div>
        <div>
          <p><strong>Mode:</strong> {detail.job.opti_mode}</p>
          <p><strong>Retry:</strong> {detail.job.retry_count}</p>
          <p><strong>Created:</strong> {new Date(detail.job.created_at).toLocaleString("tr-TR")}</p>
          <p><strong>Updated:</strong> {new Date(detail.job.updated_at).toLocaleString("tr-TR")}</p>
        </div>
      </div>
      <h3>Audit Trail</h3>
      <ul className="audit-list">
        {detail.audit.map((event) => (
          <li key={event.id}>
            <strong>{event.event_type}</strong>
            <span>{event.message}</span>
            <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("tr-TR")}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

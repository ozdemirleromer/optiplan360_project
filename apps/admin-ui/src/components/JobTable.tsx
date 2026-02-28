import type { JobSummary } from "../types";
import { Icon } from "./Icon";

interface JobTableProps {
  jobs: JobSummary[];
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onApprove: (jobId: string) => void;
}

function badgeClass(state: JobSummary["state"]): string {
  if (state === "DONE") return "badge badge-done";
  if (state === "FAILED") return "badge badge-failed";
  if (state === "HOLD") return "badge badge-hold";
  return "badge badge-running";
}

export function JobTable({ jobs, selectedJobId, onSelect, onRetry, onApprove }: JobTableProps) {
  return (
    <section className="panel" aria-labelledby="jobs-heading">
      <h2 id="jobs-heading">Jobs</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>State</th>
              <th>Mode</th>
              <th>Retry</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const selected = selectedJobId === job.id;
              return (
                <tr key={job.id} className={selected ? "row-selected" : ""}>
                  <td>
                    <button className="row-link touch-target" onClick={() => onSelect(job.id)}>
                      {job.order_id}
                    </button>
                  </td>
                  <td>
                    <span className={badgeClass(job.state)}>{job.state}</span>
                  </td>
                  <td>{job.opti_mode}</td>
                  <td>{job.retry_count}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn touch-target" onClick={() => onRetry(job.id)}>
                        <Icon name="refresh" size={16} label="Retry" />
                        <span>Retry</span>
                      </button>
                      <button
                        className="icon-btn touch-target"
                        onClick={() => onApprove(job.id)}
                        disabled={job.state !== "HOLD"}
                        aria-disabled={job.state !== "HOLD"}
                      >
                        <Icon name="checkCircle" size={16} label="Approve" />
                        <span>Approve</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./components/Icon";
import { JobDetail } from "./components/JobDetail";
import { JobTable } from "./components/JobTable";
import { Modal } from "./components/Modal";
import { SettingsPanel } from "./components/SettingsPanel";
import type { JobDetailResponse, JobSummary, JobState } from "./types";

type TabKey = "dashboard" | "settings" | "logs";
type PendingAction = { type: "retry" | "approve"; jobId: string } | null;

const REFRESH_MS = 45_000;
const MIN_RETRY_MS = 5_000;
const MAX_RETRY_MS = 120_000;

export function App() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [apiBase, setApiBase] = useState(localStorage.getItem("admin_api_base") ?? "http://127.0.0.1:8090");
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetailResponse | null>(null);
  const [filterText, setFilterText] = useState("");
  const [filterState, setFilterState] = useState<JobState | "ALL">("ALL");
  const [statusLine, setStatusLine] = useState("Hazir");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const retryDelayRef = useRef(REFRESH_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const safeFetch = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${apiBase}${url}`, {
        headers: {
          "Content-Type": "application/json",
        },
        ...init,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    },
    [apiBase],
  );

  const loadJobs = useCallback(async () => {
    let failed = false;
    try {
      const data = await safeFetch<{ jobs: JobSummary[] }>("/jobs?limit=200");
      setJobs(data.jobs);
      setStatusLine(`Job listesi guncellendi (${data.jobs.length})`);
    } catch (error) {
      failed = true;
      setStatusLine(error instanceof Error ? error.message : "Jobs okunamadi");
    }

    if (failed) {
      retryDelayRef.current = Math.min(Math.max(retryDelayRef.current * 2, MIN_RETRY_MS), MAX_RETRY_MS);
    } else {
      retryDelayRef.current = REFRESH_MS;
    }

    if (mountedRef.current) {
      timerRef.current = setTimeout(() => {
        void loadJobs();
      }, retryDelayRef.current);
    }
  }, [safeFetch]);

  const loadDetail = useCallback(
    async (jobId: string) => {
      try {
        const data = await safeFetch<JobDetailResponse>(`/jobs/${jobId}`);
        setDetail(data);
      } catch (error) {
        setStatusLine(error instanceof Error ? error.message : "Detay okunamadi");
      }
    },
    [safeFetch],
  );

  const retryJob = useCallback(
    async (jobId: string) => {
      await safeFetch(`/jobs/${jobId}/retry`, { method: "POST" });
      setStatusLine(`Retry planlandi: ${jobId}`);
      await loadJobs();
      await loadDetail(jobId);
    },
    [loadDetail, loadJobs, safeFetch],
  );

  const approveJob = useCallback(
    async (jobId: string) => {
      await safeFetch(`/jobs/${jobId}/approve`, { method: "POST" });
      setStatusLine(`Approve tamamlandi: ${jobId}`);
      await loadJobs();
      await loadDetail(jobId);
    },
    [loadDetail, loadJobs, safeFetch],
  );

  useEffect(() => {
    mountedRef.current = true;
    localStorage.setItem("admin_api_base", apiBase);
    void loadJobs();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [apiBase, loadJobs]);

  useEffect(() => {
    if (selectedJobId) {
      void loadDetail(selectedJobId);
    }
  }, [selectedJobId, loadDetail]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const textOk =
        filterText.trim().length === 0 ||
        job.order_id.toLowerCase().includes(filterText.toLowerCase()) ||
        job.id.toLowerCase().includes(filterText.toLowerCase());
      const stateOk = filterState === "ALL" || job.state === filterState;
      return textOk && stateOk;
    });
  }, [filterState, filterText, jobs]);

  const handleHealthCheck = useCallback(async () => {
    try {
      const response = await safeFetch<{ status: string }>("/health");
      setStatusLine(`Health OK: ${response.status}`);
    } catch (error) {
      setStatusLine(error instanceof Error ? error.message : "Health check basarisiz");
    }
  }, [safeFetch]);

  const handleCustomerLookup = useCallback(
    async (phone: string) => {
      try {
        const response = await safeFetch<{ customer: { id: string; name: string } | null }>(
          `/customers/lookup?phone=${encodeURIComponent(phone)}`,
        );
        if (response.customer) {
          setStatusLine(`CRM bulundu: ${response.customer.name}`);
        } else {
          setStatusLine("CRM eslesmesi bulunamadi");
        }
      } catch (error) {
        setStatusLine(error instanceof Error ? error.message : "Lookup basarisiz");
      }
    },
    [safeFetch],
  );

  const logs = detail?.audit ?? [];

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="command-bar" role="search">
          <Icon name="search" label="Search" size={16} />
          <input
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Order veya Job ID ara"
            aria-label="Order veya Job ID ara"
          />
        </div>

        <nav className="tabs" aria-label="Panel sekmeleri">
          <button className={`tab-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>Dashboard</button>
          <button className={`tab-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>Settings</button>
          <button className={`tab-btn ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>Logs</button>
        </nav>
      </header>

      <p className="status-line" aria-live="polite">{statusLine}</p>

      {tab === "dashboard" ? (
        <div className="content-grid">
          <JobTable
            jobs={filteredJobs}
            selectedJobId={selectedJobId}
            onSelect={setSelectedJobId}
            onRetry={(jobId) => setPendingAction({ type: "retry", jobId })}
            onApprove={(jobId) => setPendingAction({ type: "approve", jobId })}
          />

          <section className="panel" aria-labelledby="filters-heading">
            <h2 id="filters-heading">Filter + Detail</h2>
            <label htmlFor="stateFilter">State</label>
            <select
              id="stateFilter"
              className="touch-target"
              value={filterState}
              onChange={(event) => setFilterState(event.target.value as JobState | "ALL")}
            >
              <option value="ALL">ALL</option>
              <option value="NEW">NEW</option>
              <option value="PREPARED">PREPARED</option>
              <option value="OPTI_IMPORTED">OPTI_IMPORTED</option>
              <option value="OPTI_RUNNING">OPTI_RUNNING</option>
              <option value="OPTI_DONE">OPTI_DONE</option>
              <option value="XML_READY">XML_READY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="DONE">DONE</option>
              <option value="HOLD">HOLD</option>
              <option value="FAILED">FAILED</option>
            </select>
            <JobDetail detail={detail} />
          </section>
        </div>
      ) : null}

      {tab === "settings" ? (
        <SettingsPanel
          apiBase={apiBase}
          onApiBaseChange={setApiBase}
          onHealthCheck={handleHealthCheck}
          onCustomerLookup={handleCustomerLookup}
        />
      ) : null}

      {tab === "logs" ? (
        <section className="panel" aria-labelledby="logs-heading">
          <h2 id="logs-heading">Logs</h2>
          <ul className="audit-list">
            {logs.map((event) => (
              <li key={event.id}>
                <strong>{event.event_type}</strong>
                <span>{event.message}</span>
                <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("tr-TR")}</time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Modal
        open={pendingAction !== null}
        title={pendingAction?.type === "retry" ? "Retry Onayi" : "Approve Onayi"}
        onClose={() => setPendingAction(null)}
      >
        <p>
          {pendingAction?.type === "retry"
            ? "Bu job icin retry planlamak istiyor musunuz?"
            : "Bu job HOLD durumundan NEW durumuna alinacak. Onayliyor musunuz?"}
        </p>
        <div className="modal-actions">
          <button className="icon-btn touch-target" onClick={() => setPendingAction(null)}>
            Vazgec
          </button>
          <button
            className="primary-btn touch-target"
            onClick={() => {
              if (!pendingAction) {
                return;
              }
              const action = pendingAction;
              setPendingAction(null);
              if (action.type === "retry") {
                void retryJob(action.jobId);
              } else {
                void approveJob(action.jobId);
              }
            }}
          >
            Onayla
          </button>
        </div>
      </Modal>
    </div>
  );
}

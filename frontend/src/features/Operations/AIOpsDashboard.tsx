import { TopBar } from "../../components/Layout";
import { Badge, Button } from "../../components/Shared";
import { useAIOpsData } from "./hooks/useAIOpsData";
import { useAIOpsPresentation } from "./hooks/useAIOpsPresentation";
import { CommandPaletteBar } from "./components/CommandPaletteBar";
import { MissionMetricCard } from "./components/MissionMetricCard";
import { OrdersHoverTable } from "./components/OrdersHoverTable";
import { StationsFlowBoard } from "./components/StationsFlowBoard";
import "./aiOps.css";

export function AIOpsDashboard() {
  const { stats, activityFeed, loading, partialError, reload } = useAIOpsData();
  const { integrationToneLabel, badgeVariant, metricCards, missionOrders, riskItems } = useAIOpsPresentation(stats);

  return (
    <div className="ai-ops-shell">
      <TopBar
        title="Optiplan360 AI Orkestrasyon Merkezi"
        subtitle="Kontrol paneli: sipariş, ajan, entegrasyon ve istasyon akışlarını tek ekranda yönet"
        breadcrumbs={["İzleme", "AI Ops"]}
        centerContent={<CommandPaletteBar />}
      >
        <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
          {loading ? "Yukleniyor..." : "Yenile"}
        </Button>
      </TopBar>

      <div className="ai-ops-content-wrap">
        {partialError ? (
          <div className="ai-ops-alert">
            <span className="ai-ops-alert-dot" />
            {partialError}
          </div>
        ) : null}

        <div className="ai-ops-bento">
          <section className="ai-ops-panel ai-ops-panel-kpi">
            <header className="ai-ops-panel-head">
              <h3>KPI / Beceri Katmanı</h3>
              <div className="ai-ops-panel-meta">
                <Badge variant={badgeVariant}>{integrationToneLabel}</Badge>
                <span className="ai-ops-last-sync">Senk: {stats.lastSync}</span>
              </div>
            </header>
            <div className="ai-ops-kpi-grid">
              {metricCards.map((card, index) => (
                <MissionMetricCard key={card.id} item={card} index={index} />
              ))}
            </div>
          </section>

          <section className="ai-ops-panel ai-ops-panel-feed">
            <header className="ai-ops-panel-head">
              <h3>AI Çekirdek Canlı Akış</h3>
              <div className="ai-ops-core-pill">
                <span className="ai-ops-core-pulse" />
                AKTİF
              </div>
            </header>
            <div className="ai-ops-feed-list">
              {activityFeed.map((item, index) => (
                <article key={`${item.title}-${index}`} className="ai-ops-feed-item">
                  <span className={`ai-ops-feed-dot ai-ops-feed-${item.tone}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="ai-ops-panel ai-ops-panel-orders">
            <header className="ai-ops-panel-head">
              <h3>Siparişler</h3>
              <button type="button" className="ai-ops-ghost-btn">
                Detay Göster
              </button>
            </header>
            <OrdersHoverTable rows={missionOrders} />
          </section>

          <section className="ai-ops-panel ai-ops-panel-flow">
            <header className="ai-ops-panel-head">
              <h3>İstasyon Akış Orkestratörü</h3>
              <span className="ai-ops-flow-status">Bırakma Alanı Hazır</span>
            </header>
            <StationsFlowBoard
              runningJobs={stats.integrationsRunning}
              queueCount={stats.integrationsOutbox}
              warningCount={stats.integrationsErrors}
            />
          </section>
        </div>

        <section className="ai-ops-risk-strip">
          {riskItems.map((item) => (
            <div key={item.label} className={`ai-ops-risk-item ai-ops-risk-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, Button } from "../../components/Shared";
import { TopBar } from "../../components/Layout";
import { systemBackboneService } from "../../services/systemBackboneService";
import type {
  SystemBackboneFlow,
  SystemBackboneOverview,
  SystemBackbonePackageStatusResponse,
  SystemBackboneRoadmapResponse,
  SystemBackboneTodoItem,
} from "../../types";

const STAGES = ["foundation", "stabilization", "completed"] as const;
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "RETRYING"] as const;

type TodoCycleSnapshot = {
  id: string;
  trigger: string;
  completed: string[];
  newRequirements: string[];
  currentTodos: string[];
  blockers: string[];
  nextStep: string;
};

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function buildExternalId(
  entityType: string,
  entityId: string,
  companyId: number,
  branchId: number,
  fiscalYear: number,
) {
  return [entityType, entityId, companyId, branchId, fiscalYear]
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join("-")
    .toLowerCase();
}

export default function SystemBackbonePage() {
  const [flows, setFlows] = useState<SystemBackboneFlow[]>([]);
  const [overview, setOverview] = useState<SystemBackboneOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phaseSummary, setPhaseSummary] = useState<string | null>(null);
  const [phaseTodos, setPhaseTodos] = useState<SystemBackboneTodoItem[]>([]);
  const [roadmap, setRoadmap] = useState<SystemBackboneRoadmapResponse | null>(null);
  const [packageStatus, setPackageStatus] = useState<SystemBackbonePackageStatusResponse | null>(null);
  const [lastChainId, setLastChainId] = useState<string | null>(null);
  const [lastChainSteps, setLastChainSteps] = useState<Array<{ step: string; durationMs: number }> | null>(null);
  const [lastChainTotalDurationMs, setLastChainTotalDurationMs] = useState<number | null>(null);
  const [lastChainFailedStep, setLastChainFailedStep] = useState<string | null>(null);
  const [lastFoundationScanMode, setLastFoundationScanMode] = useState<string | null>(null);
  const [todoSnapshots, setTodoSnapshots] = useState<TodoCycleSnapshot[]>([]);

  const [flowName, setFlowName] = useState("core-working-structure");
  const [entityType, setEntityType] = useState("order");
  const [entityId, setEntityId] = useState("foundation-001");
  const [sourceSystem, setSourceSystem] = useState("optiplan360");
  const [targetSystem, setTargetSystem] = useState("mikro");
  const [stage, setStage] = useState<(typeof STAGES)[number]>("foundation");
  const [companyId, setCompanyId] = useState(1);
  const [branchId, setBranchId] = useState(0);
  const [fiscalYear, setFiscalYear] = useState(2026);
  const [externalId, setExternalId] = useState("");

  const resolvedExternalId = useMemo(
    () => externalId.trim() || buildExternalId(entityType, entityId, companyId, branchId, fiscalYear),
    [branchId, companyId, entityId, entityType, externalId, fiscalYear],
  );

  const buildTodoSnapshot = useCallback((trigger: string, todos: SystemBackboneTodoItem[]): TodoCycleSnapshot => {
    const completed = todos
      .filter((item) => ["done", "completed", "ok"].includes(String(item.status).toLowerCase()))
      .map((item) => `${item.order}. ${item.title}`);

    const blockers = todos
      .filter((item) => ["blocked", "failed", "error"].includes(String(item.status).toLowerCase()))
      .map((item) => `${item.order}. ${item.title} - ${item.detail}`);

    const currentTodos = todos.map((item) => `${item.order}. ${item.title} [${item.status}]`);

    const newRequirements = todos
      .filter((item) => String(item.status).toLowerCase() !== "done")
      .map((item) => `${item.title} için operasyonel kapanış ve izlenebilirlik tamamlanmalı`);

    const nextOpen = todos.find((item) => String(item.status).toLowerCase() !== "done");

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      trigger,
      completed,
      newRequirements,
      currentTodos,
      blockers,
      nextStep: nextOpen ? `${nextOpen.order}. ${nextOpen.title} adımını tamamla` : "Core/Hardening görev döngüsü tamamlandı",
    };
  }, []);

  const pushTodoSnapshot = useCallback(
    (trigger: string, todos: SystemBackboneTodoItem[]) => {
      const snapshot = buildTodoSnapshot(trigger, todos);
      setTodoSnapshots((prev) => [snapshot, ...prev].slice(0, 8));
    },
    [buildTodoSnapshot],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, flowList, coreTodo, roadmapData, packageStatusData] = await Promise.all([
        systemBackboneService.getOverview({ companyId, branchId, fiscalYear }),
        systemBackboneService.listFlows({ companyId, branchId, fiscalYear }),
        systemBackboneService.getPhaseTodo("core", { companyId, branchId, fiscalYear }),
        systemBackboneService.getRoadmap({ companyId, branchId, fiscalYear }),
        systemBackboneService.getPackageStatus({ companyId, branchId, fiscalYear }),
      ]);
      setOverview(overviewData);
      setFlows(flowList.data);
      setPhaseTodos(coreTodo.todos);
      setRoadmap(roadmapData);
      setPackageStatus(packageStatusData);
      pushTodoSnapshot("İlk yükleme / Core görev çekimi", coreTodo.todos);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Backbone verisi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [branchId, companyId, fiscalYear, pushTodoSnapshot]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await systemBackboneService.createFlow({
        flowName,
        entityType,
        entityId,
        externalId: resolvedExternalId,
        companyId,
        branchId,
        fiscalYear,
        sourceSystem,
        targetSystem,
        stage,
        metadata: {
          foundationReady: stage === "foundation",
          createdFrom: "SystemBackbonePage",
        },
      });
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Flow oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }, [branchId, companyId, entityId, entityType, fiscalYear, flowName, load, resolvedExternalId, sourceSystem, stage, targetSystem]);

  const advanceTargets = useMemo(
    () => ({
      foundation: { nextStage: "stabilization", nextStatus: "IN_PROGRESS", note: "Foundation tamamlandı" },
      stabilization: { nextStage: "completed", nextStatus: "COMPLETED", note: "Stabilization tamamlandı" },
      completed: { nextStage: "completed", nextStatus: "COMPLETED", note: "Akış tamamlandı" },
    }),
    [],
  );

  const handleAdvance = useCallback(
    async (flow: SystemBackboneFlow) => {
      const target = advanceTargets[flow.stage as keyof typeof advanceTargets] ?? advanceTargets.foundation;
      setLoading(true);
      setError(null);
      try {
        await systemBackboneService.advanceFlow(flow.id, {
          nextStage: target.nextStage,
          nextStatus: target.nextStatus,
          note: target.note,
          retryIncrement: false,
        });
        await load();
      } catch (advanceError) {
        setError(advanceError instanceof Error ? advanceError.message : "Flow ilerletilemedi");
      } finally {
        setLoading(false);
      }
    },
    [advanceTargets, load],
  );

  const handleCoreBootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await systemBackboneService.bootstrapCoreStructure({
        companyId,
        branchId,
        fiscalYear,
        sourceSystem,
        targetSystem,
      });
      const created = Number(result.summary.created ?? 0);
      const reused = Number(result.summary.reused ?? 0);
      setPhaseSummary(`Faz-1 tamamlandı: ${created} yeni, ${reused} mevcut akış kullanıldı.`);
      setPhaseTodos(result.todos);
      pushTodoSnapshot("Faz-1 Core Bootstrap tamamlandı", result.todos);
      await load();
    } catch (phaseError) {
      setError(phaseError instanceof Error ? phaseError.message : "Core bootstrap tamamlanamadı");
    } finally {
      setLoading(false);
    }
  }, [branchId, companyId, fiscalYear, load, pushTodoSnapshot, sourceSystem, targetSystem]);

  const handleApplyHardening = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await systemBackboneService.applyHardening({
        companyId,
        branchId,
        fiscalYear,
      });
      const hardened = Number(result.summary.hardened ?? 0);
      const total = Number(result.summary.total ?? 0);
      setPhaseSummary(`Faz-2 tamamlandı: ${hardened}/${total} akış hardening ile güncellendi.`);
      setPhaseTodos(result.todos);
      pushTodoSnapshot("Faz-2 Hardening tamamlandı", result.todos);
      await load();
    } catch (phaseError) {
      setError(phaseError instanceof Error ? phaseError.message : "Hardening uygulanamadı");
    } finally {
      setLoading(false);
    }
  }, [branchId, companyId, fiscalYear, load, pushTodoSnapshot]);

  const handleRunFoundationPackage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await systemBackboneService.runFoundationPackage({
        companyId,
        branchId,
        fiscalYear,
        sourceSystem,
        targetSystem,
      });
      setRoadmap(result.roadmap);
      setLastFoundationScanMode(String(result.workflowScan?.mode ?? ""));
      setLastChainId(null);
      setLastChainSteps(null);
      setLastChainTotalDurationMs(null);
      setLastChainFailedStep(null);
      setPhaseSummary(`Foundation paket tamamlandı: scan=${Number(result.workflowScan?.ingested_count ?? 0)} kayıt işlendi.`);
      setPackageStatus({
        companyId,
        branchId,
        fiscalYear,
        generatedAt: result.generatedAt,
        watcherEnabled: result.watcherEnabled,
        warnings: result.warnings,
        flowCount: result.flowCount,
        workflowRecordCount: result.workflowRecordCount,
        phaseCounts: result.phaseCounts,
        statusCounts: result.statusCounts,
        lastPackageRun: result.lastPackageRun ?? null,
        roadmap: result.roadmap,
      });
      pushTodoSnapshot("Foundation paket çalıştırıldı", phaseTodos);
      await load();
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "Foundation paket çalıştırılamadı");
    } finally {
      setLoading(false);
    }
  }, [branchId, companyId, fiscalYear, load, phaseTodos, pushTodoSnapshot, sourceSystem, targetSystem]);

  const handleRunStabilizationPackage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await systemBackboneService.runStabilizationPackage({
        companyId,
        branchId,
        fiscalYear,
      });
      setRoadmap(result.roadmap);
      setLastChainId(null);
      setLastChainSteps(null);
      setLastChainTotalDurationMs(null);
      setLastChainFailedStep(null);
      setPhaseSummary(`Stabilization paket tamamlandı: hardening güncellemesi uygulandı.`);
      setPackageStatus({
        companyId,
        branchId,
        fiscalYear,
        generatedAt: result.generatedAt,
        watcherEnabled: result.watcherEnabled,
        warnings: result.warnings,
        flowCount: result.flowCount,
        workflowRecordCount: result.workflowRecordCount,
        phaseCounts: result.phaseCounts,
        statusCounts: result.statusCounts,
        lastPackageRun: result.lastPackageRun ?? null,
        roadmap: result.roadmap,
      });
      pushTodoSnapshot("Stabilization paket çalıştırıldı", phaseTodos);
      await load();
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "Stabilization paket çalıştırılamadı");
    } finally {
      setLoading(false);
    }
  }, [branchId, companyId, fiscalYear, load, phaseTodos, pushTodoSnapshot]);

  const handleRunFoundationAndStabilization = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const chain = await systemBackboneService.runChainPackage({
        companyId,
        branchId,
        fiscalYear,
        sourceSystem,
        targetSystem,
      });

      setLastFoundationScanMode(String(chain.workflowScan?.mode ?? ""));
      setLastChainId(chain.chainId ?? null);
      setLastChainSteps(
        (chain.chainSteps ?? []).map((step) => ({
          step: step.step,
          durationMs: step.durationMs,
        })),
      );
      setLastChainTotalDurationMs(chain.totalDurationMs ?? null);
      setLastChainFailedStep(chain.failedStep ?? null);

      setRoadmap(chain.roadmap);
      setPackageStatus({
        companyId,
        branchId,
        fiscalYear,
        generatedAt: chain.generatedAt,
        watcherEnabled: chain.watcherEnabled,
        warnings: chain.warnings,
        flowCount: chain.flowCount,
        workflowRecordCount: chain.workflowRecordCount,
        phaseCounts: chain.phaseCounts,
        statusCounts: chain.statusCounts,
        lastPackageRun: chain.lastPackageRun ?? null,
        roadmap: chain.roadmap,
      });
      setPhaseSummary("Foundation + Stabilization zincir paketi tamamlandı.");
      pushTodoSnapshot("Foundation+Stabilization zincir paketi çalıştırıldı", phaseTodos);
      await load();
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "Zincir paket çalıştırılamadı");
    } finally {
      setLoading(false);
    }
  }, [branchId, companyId, fiscalYear, load, phaseTodos, pushTodoSnapshot, sourceSystem, targetSystem]);

  return (
    <div className="electric-page">
      <TopBar breadcrumbs={["Sistem", "Backbone"]}
        title="System Backbone"
        subtitle="Foundation ve stabilization omurgasını tek ekrandan yönetir."
      />

      <div className="app-page-container" style={{ display: "grid", gap: 16 }}>
        <Card title="Omurga Özeti" subtitle="Çalışan ana akış durumları">
          <div style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 180px))", gap: 10 }}>
            <input aria-label="company id filter" type="number" value={companyId} onChange={(e) => setCompanyId(Number(e.target.value) || 1)} placeholder="company id" />
            <input aria-label="branch id filter" type="number" value={branchId} onChange={(e) => setBranchId(Number(e.target.value) || 0)} placeholder="branch id" />
            <input aria-label="fiscal year filter" type="number" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value) || 2026)} placeholder="fiscal year" />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <SummaryTile label="Toplam" value={overview?.totalFlows ?? 0} />
            <SummaryTile label="Foundation" value={overview?.stageSummary.foundation ?? 0} />
            <SummaryTile label="Stabilization" value={overview?.stageSummary.stabilization ?? 0} />
            <SummaryTile label="Tamamlanan" value={overview?.stageSummary.completed ?? 0} />
          </div>
        </Card>

        <Card title="Yeni Backbone Flow" subtitle="Temel çalışma omurgasına yeni akış ekler">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <input value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="flow adı" />
            <input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="entity type" />
            <input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="entity id" />
            <input value={resolvedExternalId} onChange={(e) => setExternalId(e.target.value)} placeholder="external id" aria-label="external id" />
            <input type="number" value={companyId} onChange={(e) => setCompanyId(Number(e.target.value) || 1)} placeholder="company id" aria-label="company id" />
            <input type="number" value={branchId} onChange={(e) => setBranchId(Number(e.target.value) || 0)} placeholder="branch id" aria-label="branch id" />
            <input type="number" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value) || 2026)} placeholder="fiscal year" aria-label="fiscal year" />
            <input value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} placeholder="source" />
            <input value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)} placeholder="target" />
            <select value={stage} onChange={(e) => setStage(e.target.value as (typeof STAGES)[number])}>
              {STAGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Button onClick={handleCreate} disabled={loading}>
              Flow Oluştur
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Yenile
            </Button>
          </div>
        </Card>

        <Card title="Faz Yönetimi" subtitle="Önce core structure, sonra hardening uygular ve görev listesi üretir">
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Button onClick={handleCoreBootstrap} disabled={loading}>
              Faz-1 Core Bootstrap
            </Button>
            <Button variant="secondary" onClick={handleApplyHardening} disabled={loading}>
              Faz-2 Hardening
            </Button>
          </div>

          {phaseSummary ? <div style={{ marginBottom: 10 }}>{phaseSummary}</div> : null}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Görev</th>
                <th>Durum</th>
                <th>Detay</th>
              </tr>
            </thead>
            <tbody>
              {phaseTodos.map((item) => (
                <tr key={`${item.order}-${item.title}`}>
                  <td>{item.order}</td>
                  <td>{item.title}</td>
                  <td>{item.status}</td>
                  <td>{item.detail}</td>
                </tr>
              ))}
              {phaseTodos.length === 0 ? (
                <tr>
                  <td colSpan={4}>Bu bağlam için görev verisi bulunamadı.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>

        <Card title="Paket Orkestrasyonu" subtitle="Önce foundation sonra stabilization paketini toplu çalıştırır">
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Button onClick={handleRunFoundationPackage} disabled={loading}>
              Foundation Paketi Çalıştır
            </Button>
            <Button variant="secondary" onClick={handleRunStabilizationPackage} disabled={loading}>
              Stabilization Paketi Çalıştır
            </Button>
            <Button variant="secondary" onClick={handleRunFoundationAndStabilization} disabled={loading}>
              Foundation+Stabilization Çalıştır
            </Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Workflow Faz Sayaçları</div>
              <ul>
                {Object.entries(packageStatus?.phaseCounts ?? {}).map(([key, value]) => (
                  <li key={key}>{key}: {String(value)}</li>
                ))}
                {Object.keys(packageStatus?.phaseCounts ?? {}).length === 0 ? <li>Henüz faz verisi yok.</li> : null}
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Workflow Durum Sayaçları</div>
              <ul>
                {Object.entries(packageStatus?.statusCounts ?? {}).map(([key, value]) => (
                  <li key={key}>{key}: {String(value)}</li>
                ))}
                {Object.keys(packageStatus?.statusCounts ?? {}).length === 0 ? <li>Henüz durum verisi yok.</li> : null}
              </ul>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            Son Paket Durumu Üretim Zamanı: {packageStatus?.generatedAt ?? "-"}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            Son Paket Çalıştırma: {String(packageStatus?.lastPackageRun?.package ?? "-")}
            {packageStatus?.lastPackageRun?.at ? ` (${String(packageStatus.lastPackageRun.at)})` : ""}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            Son Paket Olayı: {String(packageStatus?.lastPackageRun?.eventType ?? "-")} / Kullanıcı: {String(packageStatus?.lastPackageRun?.userId ?? "-")}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            Watcher Durumu: {packageStatus?.watcherEnabled ? "Açık" : "Kapalı"}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            Core Flow Sayısı: {String(packageStatus?.flowCount ?? 0)} / Workflow Kayıt Sayısı: {String(packageStatus?.workflowRecordCount ?? 0)}
          </div>
          {(packageStatus?.warnings?.length ?? 0) > 0 ? (
            <ul style={{ marginTop: 4, color: "#b45309" }}>
              {(packageStatus?.warnings ?? []).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {lastFoundationScanMode === "WATCHER_DISABLED" ? (
            <div style={{ marginTop: 4, fontSize: 12, color: "#b45309" }}>
              Watcher kapalı: foundation paketi scan adımı atlandı.
            </div>
          ) : null}
          {lastChainId ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "#111827" }}>
              Son Chain Çalıştırma: {lastChainId}
              {(lastChainSteps ?? []).length > 0
                ? ` | ${lastChainSteps.map((step) => `${step.step}:${step.durationMs}ms`).join(" / ")}`
                : ""}
              {lastChainTotalDurationMs != null ? ` | toplam:${lastChainTotalDurationMs}ms` : ""}
              {lastChainFailedStep ? ` | failed_step:${lastChainFailedStep}` : ""}
            </div>
          ) : null}
        </Card>

        <Card title="Aşama Eksikleri" subtitle="Ana yapı ve sertleştirme eksiklerini ayrı izler">
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>Ana Yapı Eksikleri</h3>
              <ul>
                {roadmap?.anaYapiEksikleri?.length
                  ? roadmap.anaYapiEksikleri.map((item) => <li key={item}>{item}</li>)
                  : <li>Ana yapı eksiği bulunmuyor.</li>}
              </ul>

              <h4 style={{ marginBottom: 6 }}>Tamamlanan Ana Yapı</h4>
              <ul>
                {roadmap?.tamamlananAnaYapi?.length
                  ? roadmap.tamamlananAnaYapi.map((item) => <li key={item}>{item}</li>)
                  : <li>Henüz tamamlanan ana yapı maddesi yok.</li>}
              </ul>
            </div>

            <div>
              <h3 style={{ marginBottom: 6 }}>Sertleştirme/Test Eksikleri</h3>
              <ul>
                {roadmap?.sertlestirmeTestEksikleri?.length
                  ? roadmap.sertlestirmeTestEksikleri.map((item) => <li key={item}>{item}</li>)
                  : <li>Sertleştirme/test eksiği bulunmuyor.</li>}
              </ul>

              <h4 style={{ marginBottom: 6 }}>Tamamlanan Sertleştirme/Test</h4>
              <ul>
                {roadmap?.tamamlananSertlestirmeTest?.length
                  ? roadmap.tamamlananSertlestirmeTest.map((item) => <li key={item}>{item}</li>)
                  : <li>Henüz tamamlanan sertleştirme/test maddesi yok.</li>}
              </ul>
            </div>
          </div>
        </Card>

        <Card title="Görev Döngü Geçmişi" subtitle="Her ana görev sonrası zorunlu kapsam güncellemesi">
          {todoSnapshots.length === 0 ? <div>Henüz görev döngüsü oluşmadı.</div> : null}
          {todoSnapshots.map((snapshot) => (
            <div key={snapshot.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{snapshot.trigger}</div>

              <div style={{ fontSize: 13, marginBottom: 4 }}>Tamamlananlar</div>
              <ul>
                {snapshot.completed.length > 0 ? snapshot.completed.map((item) => <li key={item}>{item}</li>) : <li>Henüz tamamlanan madde yok.</li>}
              </ul>

              <div style={{ fontSize: 13, marginBottom: 4 }}>Yeni Oluşan Gereksinimler</div>
              <ul>
                {snapshot.newRequirements.length > 0
                  ? snapshot.newRequirements.map((item) => <li key={item}>{item}</li>)
                  : <li>Yeni gereksinim oluşmadı.</li>}
              </ul>

              <div style={{ fontSize: 13, marginBottom: 4 }}>Güncel Görevler</div>
              <ul>
                {snapshot.currentTodos.length > 0 ? snapshot.currentTodos.map((item) => <li key={item}>{item}</li>) : <li>Görev listesi boş.</li>}
              </ul>

              <div style={{ fontSize: 13, marginBottom: 4 }}>Bloker / Belirsizlikler</div>
              <ul>
                {snapshot.blockers.length > 0
                  ? snapshot.blockers.map((item) => <li key={item}>{item}</li>)
                  : <li>Bu döngüde bloke eden madde bulunmuyor.</li>}
              </ul>

              <div style={{ fontSize: 13 }}>Bir Sonraki Uygulama Adımı: {snapshot.nextStep}</div>
            </div>
          ))}
        </Card>

        <Card title="Akış Omurgası" subtitle="Uçtan uca çalışan foundation -> stabilization hattı">
          {error ? <div style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</div> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Flow</th>
                <th>Entity</th>
                <th>External</th>
                <th>Context</th>
                <th>Aşama</th>
                <th>Durum</th>
                <th>Retry</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.id}>
                  <td>{flow.flowName}</td>
                  <td>{flow.entityType}:{flow.entityId}</td>
                  <td>{flow.externalId ?? "-"}</td>
                  <td>{flow.companyId}/{flow.branchId}/{flow.fiscalYear}</td>
                  <td>{flow.stage}</td>
                  <td>{flow.status}</td>
                  <td>{flow.retryCount}/{flow.maxRetries}{flow.nextRetryAt ? ` (${flow.retryCooldownSeconds}s)` : ""}</td>
                  <td>
                    <Button size="sm" onClick={() => void handleAdvance(flow)} disabled={loading || flow.stage === "completed"}>
                      İlerlet
                    </Button>
                  </td>
                </tr>
              ))}
              {flows.length === 0 ? (
                <tr>
                  <td colSpan={8}>Backbone flow bulunamadı.</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            Geçerli status seti: {STATUSES.join(", ")}
          </div>
        </Card>
      </div>
    </div>
  );
}
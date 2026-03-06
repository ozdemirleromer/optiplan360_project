import { NumberInput } from "../../components/Shared";

export interface RoomDimensions {
  wallN: number;
  wallE: number;
  wallS: number;
  wallW: number;
  layoutType: "line" | "L" | "U";
}

interface RoomSettingsPanelProps {
  roomDimensions: RoomDimensions;
  onRoomDimensionsChange: (dimensions: RoomDimensions) => void;
}

export default function RoomSettingsPanel({
  roomDimensions,
  onRoomDimensionsChange,
}: RoomSettingsPanelProps) {
  const updateWall = (key: keyof Pick<RoomDimensions, "wallN" | "wallE">, value: number) => {
    const next = {
      ...roomDimensions,
      [key]: value,
    };
    onRoomDimensionsChange({
      ...next,
      wallS: next.wallN,
      wallW: next.wallE,
    });
  };

  const updateLayout = (layoutType: RoomDimensions["layoutType"]) => {
    onRoomDimensionsChange({
      ...roomDimensions,
      layoutType,
    });
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-semibold text-slate-100">Oda Ayarlari</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Yerlesim tipi ve duvar uzunluklari, optimizasyon on izlemesini hizlica kalibre etmek icin kullanilir.
          </p>
        </div>
        <span className="rounded-full border border-cyan-900 bg-cyan-950/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">
          Prototype
        </span>
      </div>

      <div className="grid gap-3">
        <NumberInput
          label="Duvar 1"
          value={roomDimensions.wallN}
          onChange={(event) => updateWall("wallN", Number(event.target.value) || 0)}
          min={300}
          max={10000}
          step={10}
          helperText="Kuzey-Guney ekseni"
          containerStyle={{ gap: 4 }}
        />
        <NumberInput
          label="Duvar 2"
          value={roomDimensions.wallE}
          onChange={(event) => updateWall("wallE", Number(event.target.value) || 0)}
          min={300}
          max={10000}
          step={10}
          helperText="Dogu-Bati ekseni"
          containerStyle={{ gap: 4 }}
        />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Yerlesim tipi
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["line", "L", "U"] as const).map((type) => {
            const active = roomDimensions.layoutType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => updateLayout(type)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-blue-400 bg-blue-600/20 text-blue-100"
                    : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-slate-200">Aktif geometri</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-400">
            {roomDimensions.layoutType}
          </span>
        </div>
        <div className="mt-2 text-slate-400">
          {roomDimensions.wallN} x {roomDimensions.wallE} mm
        </div>
      </div>
    </section>
  );
}


'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, MapPin, Radar, ExternalLink } from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import {
  createLocation,
  updateLocation,
  deleteLocation,
  createGeoFence,
  updateGeoFence,
  deleteGeoFence,
} from './actions';

export interface FenceRow {
  id: string;
  nameAr: string;
  nameEn: string | null;
  centerLat: string;
  centerLng: string;
  radiusMeters: number;
  kind: string;
  clientId: string | null;
  clientName: string | null;
  active: boolean;
  locationCount: number;
}

export interface LocationRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  city: string | null;
  district: string | null;
  addressLines: string | null;
  coordinates: string | null;
  geoFenceId: string | null;
  geoFenceName: string | null;
  bestTimeToShoot: string | null;
  parkingInfo: string | null;
  permitRequired: boolean;
  hasPower: boolean | null;
}

export interface ClientOption {
  id: string;
  name: string;
}

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-muted)]';

const FENCE_KIND_LABEL: Record<string, string> = {
  office: 'مكتب',
  studio: 'استوديو',
  recurring_client_site: 'موقع عميل متكرّر',
};

function mapsHref(coords: string | null): string | null {
  if (!coords) return null;
  const m = coords.split(',').map((s) => s.trim());
  if (m.length !== 2) return null;
  return `https://www.google.com/maps?q=${m[0]},${m[1]}`;
}

// ════════════════════════════════════════════════════════════════════════════
//  GEO-FENCES
// ════════════════════════════════════════════════════════════════════════════

function GeoFencesSection({
  fences,
  clients,
}: {
  fences: FenceRow[];
  clients: ClientOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--text)]">السياجات الجغرافية</h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {fences.length} سياج · مركز + نصف قطر للحضور والتحقّق الموقعي
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} /> سياج جديد
          </button>
        )}
      </div>

      {creating && (
        <FenceForm
          clients={clients}
          mode="create"
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {fences.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center">
          <Radar size={22} className="mx-auto text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text)]">لا سياجات بعد</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            أضف سياج المكتب أولاً (مركز + نصف قطر) ثم اربطه بمواقع التصوير.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {fences.map((f) =>
            editingId === f.id ? (
              <li key={f.id}>
                <FenceForm
                  clients={clients}
                  mode="edit"
                  fence={f}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)]">
                    <Radar size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--text)]">
                        {f.nameAr}
                      </span>
                      <StatusPill tone="neutral" withDot={false}>
                        {FENCE_KIND_LABEL[f.kind] ?? f.kind}
                      </StatusPill>
                      {!f.active && (
                        <StatusPill tone="danger" withDot={false}>
                          معطّل
                        </StatusPill>
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                      {Number(f.centerLat).toFixed(5)}, {Number(f.centerLng).toFixed(5)} · r=
                      {f.radiusMeters}m
                      {f.clientName ? ` · ${f.clientName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone="neutral" withDot={false}>
                    {f.locationCount} موقع
                  </StatusPill>
                  <button
                    type="button"
                    title="تعديل"
                    onClick={() => {
                      setEditingId(f.id);
                      setCreating(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <form
                    action={deleteGeoFence}
                    onSubmit={(e) => {
                      if (!confirm(`حذف سياج "${f.nameAr}"؟ ستُفصل المواقع المرتبطة.`))
                        e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={f.id} />
                    <button
                      type="submit"
                      title="حذف"
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </form>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function FenceForm({
  clients,
  mode,
  fence,
  onDone,
  onCancel,
}: {
  clients: ClientOption[];
  mode: 'create' | 'edit';
  fence?: FenceRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = mode === 'create' ? createGeoFence : updateGeoFence;
  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      {mode === 'edit' && fence && <input type="hidden" name="id" value={fence.id} />}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">
          {mode === 'create' ? 'سياج جديد' : `تعديل ${fence?.nameAr}`}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>الاسم (عربي)</label>
          <input name="nameAr" required defaultValue={fence?.nameAr ?? ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>الاسم (إنجليزي)</label>
          <input name="nameEn" defaultValue={fence?.nameEn ?? ''} className={inputCls} dir="ltr" />
        </div>
        <div>
          <label className={labelCls}>خط العرض (lat)</label>
          <input
            name="centerLat"
            required
            type="number"
            step="any"
            placeholder="24.7136"
            defaultValue={fence?.centerLat ?? ''}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>خط الطول (lng)</label>
          <input
            name="centerLng"
            required
            type="number"
            step="any"
            placeholder="46.6753"
            defaultValue={fence?.centerLng ?? ''}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>نصف القطر (متر)</label>
          <input
            name="radiusMeters"
            type="number"
            min={10}
            defaultValue={fence?.radiusMeters ?? 100}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>النوع</label>
          <select name="kind" defaultValue={fence?.kind ?? 'office'} className={inputCls}>
            <option value="office">مكتب</option>
            <option value="studio">استوديو</option>
            <option value="recurring_client_site">موقع عميل متكرّر</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>العميل (اختياري)</label>
          <select name="clientId" defaultValue={fence?.clientId ?? ''} className={inputCls}>
            <option value="">— بلا عميل —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {mode === 'edit' && (
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
            <input
              type="checkbox"
              name="active"
              defaultChecked={fence?.active ?? true}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            مفعّل
          </label>
        )}
      </div>

      <FormButtons onCancel={onCancel} />
    </form>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  LOCATIONS
// ════════════════════════════════════════════════════════════════════════════

function LocationsSection({
  locations,
  fences,
}: {
  locations: LocationRow[];
  fences: FenceRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--text)]">المواقع</h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {locations.length} موقع · المكتب، الاستوديو، ومواقع التصوير
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} /> موقع جديد
          </button>
        )}
      </div>

      {creating && (
        <LocationForm
          fences={fences}
          mode="create"
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {locations.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center">
          <MapPin size={22} className="mx-auto text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text)]">لا مواقع بعد</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            أضف موقع المكتب ومواقع التصوير المتكرّرة لتسريع التخطيط.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {locations.map((l) =>
            editingId === l.id ? (
              <li key={l.id}>
                <LocationForm
                  fences={fences}
                  mode="edit"
                  location={l}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)]">
                    <MapPin size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--text)]">
                        {l.nameAr}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-dim)]">{l.code}</span>
                      {l.permitRequired && (
                        <StatusPill tone="warning" withDot={false}>
                          تصريح
                        </StatusPill>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {[l.city, l.district].filter(Boolean).join(' · ') || '—'}
                      {l.geoFenceName ? ` · سياج: ${l.geoFenceName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {mapsHref(l.coordinates) && (
                    <a
                      href={mapsHref(l.coordinates)!}
                      target="_blank"
                      rel="noreferrer"
                      title="فتح في الخرائط"
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    type="button"
                    title="تعديل"
                    onClick={() => {
                      setEditingId(l.id);
                      setCreating(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <form
                    action={deleteLocation}
                    onSubmit={(e) => {
                      if (!confirm(`حذف موقع "${l.nameAr}"؟`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={l.id} />
                    <button
                      type="submit"
                      title="حذف"
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </form>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function LocationForm({
  fences,
  mode,
  location,
  onDone,
  onCancel,
}: {
  fences: FenceRow[];
  mode: 'create' | 'edit';
  location?: LocationRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = mode === 'create' ? createLocation : updateLocation;
  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      {mode === 'edit' && location && <input type="hidden" name="id" value={location.id} />}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">
          {mode === 'create' ? 'موقع جديد' : `تعديل ${location?.nameAr}`}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mode === 'create' && (
          <div>
            <label className={labelCls}>الرمز (code)</label>
            <input
              name="code"
              required
              placeholder="HQ"
              className={inputCls + ' font-mono uppercase'}
              dir="ltr"
            />
          </div>
        )}
        <div>
          <label className={labelCls}>الاسم (عربي)</label>
          <input name="nameAr" required defaultValue={location?.nameAr ?? ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>الاسم (إنجليزي)</label>
          <input name="nameEn" defaultValue={location?.nameEn ?? ''} className={inputCls} dir="ltr" />
        </div>
        <div>
          <label className={labelCls}>المدينة</label>
          <input name="city" defaultValue={location?.city ?? ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>الحي</label>
          <input name="district" defaultValue={location?.district ?? ''} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>العنوان</label>
          <input
            name="addressLines"
            defaultValue={location?.addressLines ?? ''}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>الإحداثيات (lat,lng)</label>
          <input
            name="coordinates"
            placeholder="24.7136,46.6753"
            defaultValue={location?.coordinates ?? ''}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>السياج الجغرافي</label>
          <select
            name="geoFenceId"
            defaultValue={location?.geoFenceId ?? ''}
            className={inputCls}
          >
            <option value="">— بلا سياج —</option>
            {fences.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>أفضل وقت للتصوير</label>
          <input
            name="bestTimeToShoot"
            placeholder="صباحاً قبل ١٠"
            defaultValue={location?.bestTimeToShoot ?? ''}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>معلومات المواقف</label>
          <input
            name="parkingInfo"
            defaultValue={location?.parkingInfo ?? ''}
            className={inputCls}
          />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <input
            type="checkbox"
            name="permitRequired"
            defaultChecked={location?.permitRequired ?? false}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          يتطلّب تصريح تصوير
        </label>
        <label className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <input
            type="checkbox"
            name="hasPower"
            defaultChecked={location?.hasPower ?? false}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          يتوفّر كهرباء
        </label>
      </div>

      <FormButtons onCancel={onCancel} />
    </form>
  );
}

// ── shared form footer ───────────────────────────────────────────────────────

function FormButtons({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-9 rounded-md border border-[var(--line)] px-4 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        إلغاء
      </button>
      <button
        type="submit"
        className="h-9 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
      >
        حفظ
      </button>
    </div>
  );
}

// ── page-level wrapper ─────────────────────────────────────────────────────

export function LocationsManager({
  locations,
  fences,
  clients,
}: {
  locations: LocationRow[];
  fences: FenceRow[];
  clients: ClientOption[];
}) {
  return (
    <div className="space-y-8">
      <GeoFencesSection fences={fences} clients={clients} />
      <div className="h-px bg-[var(--line)]" />
      <LocationsSection locations={locations} fences={fences} />
    </div>
  );
}

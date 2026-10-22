import { useState, type ReactNode } from 'react';
import { useStore } from '../../app/store';
import { DEFAULT_SETTINGS, type MotionSetting, type Settings, type ThemeSetting } from '../../lib/storage';

function Radio<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label={name}>
      {options.map(([v, label]) => (
        <label key={v}>
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function Row({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-rule py-4 sm:grid-cols-[16rem_1fr] sm:gap-8">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {help && <p className="mt-0.5 text-sm text-pencil">{help}</p>}
      </div>
      <div className="flex items-start">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function SettingsView() {
  const { save, update } = useStore();
  const s = save.settings;
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((d) => ({ ...d, settings: { ...d.settings, [k]: v } }));
  const progressCount = Object.keys(save.games).length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <h1 className="text-xl font-semibold">Cài đặt</h1>
      <p className="mt-0.5 text-sm text-pencil">Chỉ lưu trong trình duyệt này.</p>
      <div className="mt-4 max-w-3xl border-t border-rule">
        <Row title="Giao diện">
          <Radio<ThemeSetting> name="Giao diện" value={s.theme} onChange={(v) => set('theme', v)} options={[['system', 'Hệ thống'], ['light', 'Sáng'], ['dark', 'Tối']]} />
        </Row>
        <Row title="Chuyển động" help="Chế độ Hệ thống tuân theo cài đặt giảm chuyển động của thiết bị.">
          <Radio<MotionSetting> name="Chuyển động" value={s.motion} onChange={(v) => set('motion', v)} options={[['system', 'Hệ thống'], ['reduce', 'Giảm'], ['full', 'Đầy đủ']]} />
        </Row>
        <Row title="Âm thanh" help="Tiếng tích nhẹ khi tô và hợp âm khi giải xong.">
          <Toggle label="Bật âm thanh" checked={s.sound} onChange={(v) => set('sound', v)} />
        </Row>
        <Row title="Bảng chơi">
          <div className="space-y-2.5">
            <Toggle label="Giới hạn thao tác kéo trong một hàng hoặc cột" checked={s.axisLock} onChange={(v) => set('axisLock', v)} />
            <Toggle label="Làm nổi bật hàng và cột dưới con trỏ" checked={s.crosshair} onChange={(v) => set('crosshair', v)} />
          </div>
        </Row>
        <Row title="Tiến độ đã lưu" help={`Bảng, thời gian và trạng thái giải của ${progressCount} câu đố. Các câu đố bạn tự vẽ được giữ lại.`}>
          {done ? (
            <p className="text-sm text-solved" role="status">
              Đã xóa tiến độ.
            </p>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Xóa toàn bộ tiến độ và kỷ lục thời gian?</span>
              <button
                type="button"
                className="btn btn-ink"
                onClick={() => {
                  update((d) => ({ ...d, games: {}, currentId: null }));
                  setConfirming(false);
                  setDone(true);
                }}
              >
                Xóa tiến độ
              </button>
              <button type="button" className="btn btn-line" onClick={() => setConfirming(false)}>
                Hủy
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-line" disabled={progressCount === 0} onClick={() => setConfirming(true)}>
              Đặt lại tiến độ đã lưu
            </button>
          )}
        </Row>
        <Row title="Mặc định">
          <button type="button" className="btn btn-line" onClick={() => update((d) => ({ ...d, settings: { ...DEFAULT_SETTINGS } }))}>
            Khôi phục cài đặt mặc định
          </button>
        </Row>
      </div>
    </div>
  );
}

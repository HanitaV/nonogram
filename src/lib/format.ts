export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export const difficultyLabel: Record<string, string> = {
  beginner: 'Nhập môn',
  easy: 'Dễ',
  intermediate: 'Trung bình',
  advanced: 'Nâng cao',
  boss: 'Boss cuối',
  custom: 'Tùy chỉnh',
};

export function plural(n: number, one: string, many = one): string {
  return `${n} ${n === 1 ? one : many}`;
}

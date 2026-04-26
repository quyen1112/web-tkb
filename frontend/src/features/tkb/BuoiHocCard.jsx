const FIELD_ALIAS = {
  id: ['id', 'buoi_hoc_id'],
  phong: ['phong_hoc', 'phong', 'ten_phong'],
  tenMon: ['ten_mon_hoc', 'ten_mon', 'tenMonHoc', 'tenMon'],
  maMon: ['ma_mon_hoc', 'ma_hoc_phan', 'ma_mon', 'maMon'],
  lopHocPhan: ['ma_lop_hoc_phan', 'ma_lop_hp', 'lop_hoc_phan', 'lopHocPhan'],
  tietBatDau: ['tiet_bat_dau', 'tiet'],
  tietKetThuc: ['tiet_ket_thuc'],
  gioBatDau: ['gio_bat_dau', 'gio'],
  giangVien: ['giang_vien', 'ten_gv'],
  hinhThuc: ['hinh_thuc', 'loai_buoi'],
};

function pick(raw, ...aliases) {
  for (const alias of aliases) {
    if (alias && raw[alias] !== undefined && raw[alias] !== null && raw[alias] !== '') {
      return raw[alias];
    }
  }

  return undefined;
}

function isFilled(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeItem(raw = {}) {
  return {
    id: pick(raw, ...FIELD_ALIAS.id),
    phong: pick(raw, ...FIELD_ALIAS.phong),
    tenMon: pick(raw, ...FIELD_ALIAS.tenMon),
    maMon: pick(raw, ...FIELD_ALIAS.maMon),
    lopHocPhan: pick(raw, ...FIELD_ALIAS.lopHocPhan),
    tietBatDau: pick(raw, ...FIELD_ALIAS.tietBatDau),
    tietKetThuc: pick(raw, ...FIELD_ALIAS.tietKetThuc),
    gioBatDau: pick(raw, ...FIELD_ALIAS.gioBatDau),
    giangVien: pick(raw, ...FIELD_ALIAS.giangVien),
    hinhThuc: pick(raw, ...FIELD_ALIAS.hinhThuc),
    raw,
  };
}

function formatTiet(item) {
  if (isFilled(item.tietBatDau) && isFilled(item.tietKetThuc)) {
    return `${item.tietBatDau}-${item.tietKetThuc}`;
  }

  if (isFilled(item.tietBatDau)) {
    return `${item.tietBatDau}`;
  }

  return undefined;
}

function getBadgeMeta(hinhThuc) {
  if (!isFilled(hinhThuc)) {
    return null;
  }

  const key = String(hinhThuc).toLowerCase().trim();

  if (['lt', 'ly_thuyet', 'lý thuyết'].includes(key)) {
    return { label: '[LT]', variant: 'lt' };
  }

  if (['th', 'thuc_hanh', 'thực hành'].includes(key)) {
    return { label: '[TH]', variant: 'th' };
  }

  return { label: `[${String(hinhThuc).slice(0, 8)}]`, variant: 'neutral' };
}

function handleKeyDown(event, callback, payload) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback(payload);
  }
}

function MetaLine({ label, value }) {
  if (!isFilled(value)) {
    return null;
  }

  return (
    <div className="buoi-hoc-card__meta-line">
      <span className="buoi-hoc-card__meta-label">{label}</span>
      <span className="buoi-hoc-card__meta-value">{value}</span>
    </div>
  );
}

export default function BuoiHocCard({
  item: rawItem,
  mode = 'view',
  onClick,
  onEdit,
  className = '',
}) {
  if (!rawItem || typeof rawItem !== 'object') {
    return null;
  }

  const item = normalizeItem(rawItem);
  const payload = item.raw || item;
  const isClickable = typeof onClick === 'function';
  const tiet = formatTiet(item);
  const badge = getBadgeMeta(item.hinhThuc);

  return (
    <div
      className={[
        'buoi-hoc-card',
        mode === 'edit' ? 'buoi-hoc-card--edit' : 'buoi-hoc-card--view',
        isClickable ? 'buoi-hoc-card--clickable' : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={isClickable ? () => onClick(payload) : undefined}
      onKeyDown={isClickable ? (event) => handleKeyDown(event, onClick, payload) : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {mode === 'edit' && typeof onEdit === 'function' && (
        <button
          type="button"
          className="buoi-hoc-card__edit-btn"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(payload);
          }}
          title="Sua"
        >
          ✎
        </button>
      )}

      <div className="buoi-hoc-card__header">
        {isFilled(item.phong) && <div className="buoi-hoc-card__phong">{item.phong}</div>}
        {isFilled(item.tenMon) && <div className="buoi-hoc-card__ten-mon">{item.tenMon}</div>}
        {isFilled(item.maMon) && <div className="buoi-hoc-card__ma-mon">{item.maMon}</div>}
      </div>

      <div className="buoi-hoc-card__divider" />

      <div className="buoi-hoc-card__meta">
        <MetaLine label="LHP:" value={item.lopHocPhan} />
        <MetaLine label="Tiet:" value={tiet} />
        <MetaLine label="Gio:" value={item.gioBatDau} />
        <MetaLine label="GV:" value={item.giangVien} />
      </div>

      {badge && (
        <div className="buoi-hoc-card__badge-row">
          <span className={`buoi-hoc-card__badge buoi-hoc-card__badge--${badge.variant}`}>
            {badge.label}
          </span>
        </div>
      )}
    </div>
  );
}

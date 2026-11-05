/** 공통 UI 요소 — 시안의 'UI 공통 요소 예시' (프로필·재화·메일·공지·설정), 패널, 버튼, 아이콘 */
import type { CSSProperties, ReactNode } from 'react';
import { uiUrl } from '../pets/atlas';
import { go, back, type Route } from '../app/router';
import { PLAYER } from '../data/mock';

export const icon = (name: string) => uiUrl(`icons/${name}.webp`);
export const bg = (name: string) => uiUrl(`bg/${name}.webp`);

export function Icon({ name, size = 40, style, className }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  return <img src={icon(name)} alt="" aria-hidden width={size} height={size} className={`ic ${className ?? ''}`} style={{ width: size, height: size, ...style }} draggable={false} />;
}

export function Screen({ bgName, children, className, tint, testId }: { bgName?: string; children: ReactNode; className?: string; tint?: string; testId?: string }) {
  return (
    <div className={`screen ${className ?? ''}`} data-testid={testId} style={bgName ? { backgroundImage: `url(${bg(bgName)})` } : undefined}>
      {tint && <div className="tint" style={{ background: tint }} />}
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant = 'gold', size = 'md', style, disabled, testId }: { children: ReactNode; onClick?: () => void; variant?: 'gold' | 'purple' | 'white' | 'green' | 'pink'; size?: 'sm' | 'md' | 'lg'; style?: CSSProperties; disabled?: boolean; testId?: string }) {
  return <button type="button" className={`btn btn-${variant} btn-${size}`} onClick={onClick} style={style} disabled={disabled} data-testid={testId}>{children}</button>;
}

export function Panel({ title, children, style, className, onClose }: { title?: ReactNode; children: ReactNode; style?: CSSProperties; className?: string; onClose?: () => void }) {
  return (
    <div className={`panel ${className ?? ''}`} style={style}>
      {title && <div className="panel-ribbon">{title}</div>}
      {onClose && <button type="button" className="panel-close" onClick={onClose} aria-label="닫기">✕</button>}
      {children}
    </div>
  );
}

export function Bar({ value, max, color = 'var(--purple)', height = 14, label }: { value: number; max: number; color?: string; height?: number; label?: string }) {
  return (
    <div className="bar" style={{ height }} role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <div className="bar-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      {label && <span className="bar-label">{label}</span>}
    </div>
  );
}

export function Currency({ iconName, value, onPlus }: { iconName: string; value: number; onPlus?: () => void }) {
  return (
    <div className="chip currency">
      <Icon name={iconName} size={34} />
      <b>{value.toLocaleString()}</b>
      {onPlus && <button type="button" className="plus" onClick={onPlus} aria-label="충전">+</button>}
    </div>
  );
}

export function ProfileChip({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="chip profile-chip" onClick={onClick ?? (() => go('profile'))} aria-label="프로필">
      <img src={uiUrl('avatar_player.webp')} alt="" className="avatar" />
      <div className="pc-info">
        <span className="pc-lv">Lv.{PLAYER.level}</span>
        <Bar value={PLAYER.exp} max={PLAYER.expMax} height={12} label={`${PLAYER.exp}/${PLAYER.expMax}`} />
      </div>
    </button>
  );
}

/** 상단 HUD: 프로필 · 코인 · 보석 · (하트) · 메일 · 공지 · 설정 */
export function TopHud({ hearts, extra, showBack, title }: { hearts?: boolean; extra?: ReactNode; showBack?: boolean; title?: ReactNode }) {
  return (
    <div className="top-hud">
      <div className="hud-left">
        {showBack ? <button type="button" className="round-btn back-btn" onClick={back} aria-label="뒤로">‹</button> : <ProfileChip />}
        {title && <div className="hud-title">{title}</div>}
      </div>
      <div className="hud-right">
        <Currency iconName="coin" value={PLAYER.coins} onPlus={() => go('shop')} />
        <Currency iconName="gem" value={PLAYER.gems} onPlus={() => go('shop')} />
        {hearts && <Currency iconName="heart" value={PLAYER.hearts} />}
        {extra}
        <HudIcon name="mail" label="메일" badge />
        <HudIcon name="notice" label="공지" />
        <HudIcon name="settings" label="설정" onClick={() => go('profile', { tab: 'settings' })} />
      </div>
    </div>
  );
}

export function HudIcon({ name, label, onClick, badge, size = 46 }: { name: string; label: string; onClick?: () => void; badge?: boolean; size?: number }) {
  return (
    <button type="button" className="hud-icon" onClick={onClick ?? (() => toast(`${label} — 준비 중이에요`))} aria-label={label}>
      <Icon name={name} size={size} />
      {badge && <span className="dot">!</span>}
      <span className="hud-icon-label">{label}</span>
    </button>
  );
}

export function SideMenu<T extends string>({ items, value, onChange }: { items: { id: T; label: string; icon?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="side-menu" role="tablist">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} className={value === it.id ? 'on' : ''} onClick={() => onChange(it.id)}>
          {it.icon && <Icon name={it.icon} size={30} />}<span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string; badge?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} className={value === it.id ? 'on' : ''} onClick={() => onChange(it.id)}>
          {it.label}{it.badge && <span className="dot">!</span>}
        </button>
      ))}
    </div>
  );
}

export const navTo = (r: Route, p?: Record<string, string | number>) => () => go(r, p);

// ── 토스트 (간단한 전역 알림) ──
let toastHandler: ((m: string) => void) | null = null;
export const setToastHandler = (h: typeof toastHandler) => { toastHandler = h; };
export const toast = (m: string) => toastHandler?.(m);

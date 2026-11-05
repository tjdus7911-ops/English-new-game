/** ⑫ 상점 및 아이템 인벤토리 (구매 처리는 게임 시스템 단계) */
import { useState } from 'react';
import { Icon, Screen, SideMenu, Tabs, TopHud, toast } from '../ui/kit';
import { INVENTORY, SHOP_ITEMS } from '../data/mock';

type Cat = 'rec' | 'toy' | 'deco' | 'island';
type Tab = 'shop' | 'bag';

export function ShopScreen({ params }: { params: URLSearchParams }) {
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'bag' ? 'bag' : 'shop');
  const [cat, setCat] = useState<Cat>('rec');
  const items = cat === 'rec' ? SHOP_ITEMS.slice(0, 6) : SHOP_ITEMS.filter((i) => i.cat === cat);
  return (
    <Screen className="magic-bg sparkle-bg" testId="screen-shop">
      <TopHud showBack title="상점" />
      <div className="awning" />
      <div className="book" style={{ top: 170 }}>
        <div className="book-side">
          <SideMenu<Cat> value={cat} onChange={setCat} items={[{ id: 'rec', label: '추천', icon: 'chest' }, { id: 'toy', label: '장난감', icon: 'ball' }, { id: 'deco', label: '꾸미기', icon: 'ribbon' }, { id: 'island', label: '섬 꾸미기', icon: 'signpost' }]} />
        </div>
        <div className="book-main">
          <Tabs<Tab> value={tab} onChange={setTab} items={[{ id: 'shop', label: '상점' }, { id: 'bag', label: '가방(인벤토리)' }]} />
          <div className="shop-grid">
            {tab === 'shop' && items.map((it) => (
              <button key={it.id} type="button" className="shop-card" onClick={() => toast(`${it.name} — 구매는 게임 시스템 단계에서 연결돼요`)}>
                <span className="shop-name">{it.name}</span>
                <Icon name={it.icon} size={120} />
                <span className="price-tag"><Icon name="coin" size={30} />{it.price}</span>
              </button>
            ))}
            {tab === 'bag' && INVENTORY.map((it) => (
              <div key={it.id} className="shop-card">
                <span className="shop-name">{it.name}</span>
                <Icon name={it.icon} size={120} />
                <span className="price-tag" style={{ background: '#EEE8FB', color: 'var(--purple-d)' }}>× {it.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}

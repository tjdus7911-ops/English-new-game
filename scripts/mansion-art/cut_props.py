"""
2단계 가구·소품 시트(Figma AI 생성, 마젠타 배경) → 개별 투명 스프라이트 art/figma-a/props/cut/<name>.png
사용: python3 scripts/mansion-art/cut_props.py
"""
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
ns = {'__file__': os.path.join(ROOT, 'scripts/mansion-art/import_figma_a.py')}
src = open(ns['__file__']).read()
exec(src.split("sheet_objects('a-sheet")[0], ns)
P = os.path.join(ROOT, 'art/figma-a/props'); OUT = os.path.join(P, 'cut'); os.makedirs(OUT, exist_ok=True)
SHEETS = [
  ('sheet-sofas-armchairs_49-2.png', 3, 2, 'sofa-camel-green sofa-cream-linen sofa-chesterfield-brown arm-wingback-rose arm-cognac arm-bergere-ivory'),
  ('sheet-tables_49-3.png', 3, 2, 'ctable-walnut ctable-marble ctable-oak stable-mahogany stable-marble stable-cream'),
  ('sheet-cabinets-consoles_49-4.png', 3, 2, 'store-bookcase store-cupboard store-secretary console-gilt console-walnut console-cream'),
  ('sheet-chandeliers-displays_50-2.png', 3, 2, 'chand-crystal chand-iron chand-tulip disp-walnut disp-white disp-oak'),
  ('sheet-sconces-mirrors_51-2.png', 3, 2, 'sconce-twin sconce-iron sconce-tulip mirror-oval mirror-walnut mirror-sun'),
  ('sheet-cushions-vases_51-3.png', 3, 2, 'cushion-rose cushion-sage cushion-cream vase-porcelain vase-amber vase-brass'),
  ('sheet-clocks-candles-ornaments_51-4.png', 3, 3, 'clock-gilt clock-walnut clock-porcelain candle-brass candle-silver candle-wood orn-foodog orn-globe orn-urns'),
  ('sheet-books-statues-trays_51-5.png', 3, 3, 'books-stack books-glass books-ends statue-bust statue-horse statue-shepherdess tray-tea tray-perfume tray-apples'),
  ('sheet-frames-flowers_51-6.png', 3, 2, 'frame-lake frame-roses frame-ship flower-roses flower-lilies flower-wild'),
  ('sheet-plants-doors_51-7.png', 3, 2, 'plant-fig plant-snake plant-topiary door-white door-oak door-sage'),
  ('sheet-narrow-cabinets_52-2.png', 3, 1, 'tall-bookcase tall-cupboard tall-clockcase'),
]
for name, c, r, names in SHEETS:
    ns['SRC'] = P
    for im, n in zip(ns['cells'](name, c, r), names.split()):
        ns['trim'](ns['drop_specks'](im, 0.15)).save(os.path.join(OUT, n + '.png'))
print(len(os.listdir(OUT)), 'sprites')

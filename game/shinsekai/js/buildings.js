/* =============================================================================
 *  buildings.js  →  window.Buildings
 * -----------------------------------------------------------------------------
 *  ジャンジャン横丁のアーケード（屋根アーチ＋吊り看板）と、
 *  通り両脇の雑居ビル群（西列6棟 + 東列6棟 = 計12棟）を建てる。
 *
 *  - 座標は DESIGN.md §2.2 の確定値に厳密に従う
 *      西列センターX = -16 / 東列センターX = +16
 *      Z列センター   = 0, -14, -28, -42, -56, -70（ピッチ14）
 *      建物フットプリント 幅≤11(X) × 奥行≤10(Z)、高さは個別（8〜20）
 *  - 壁は Tex.wall（窓・タイル・配管・室外機）。夜は窓が灯る（night:true）。
 *  - 各ビルに Tex.signboard の派手な袖看板＋壁面看板、夜は Tex.neon を emissive で重ねる。
 *  - 軒先に Tex.noren を平面で吊るす。
 *  - 各棟 group に userData.info（業種名＋一言情報）を入れて City.register。
 *  - 昼夜切替は group.userData.onNight(flag) で看板/窓/ネオンの emissiveIntensity を切替。
 *  - ネオン代表 PointLight を1棟1灯 City.addDecoLight（予算24灯内）。
 *  - アーケード屋根は西列⇔東列をつなぐ骨組み（梁）＋半透明の帯屋根（opacity 0.25）。
 *  - 「ジャンジャン横丁」全体の情報は通りの“透明クリック板”（kind:"street"）が持つ。
 *
 *  依存: window.City, window.Tex, グローバル THREE（r137 / UMD）
 *  公開: window.Buildings
 *  ※ import/export/require/fetch/外部URL は使わない。すべて window 経由。
 * ===========================================================================*/
(function () {
  'use strict';

  // §2.1 / §2.2 レイアウト定数（DESIGN.md と一致させること）
  var WEST_X = -16;   // 西列センターX
  var EAST_X = 16;    // 東列センターX
  var Z_CENTERS = [0, -14, -28, -42, -56, -70]; // 各棟の中心Z（ピッチ14）

  var BLDG_W = 11;    // フットプリント幅（X）最大11（重なり防止の上限）
  var BLDG_D = 10;    // フットプリント奥行（Z）最大10

  var ARCADE_Z_MIN = -76; // アーケード南端 z（City.STREET_Z_MIN 相当）
  var ARCADE_Z_MAX = 6;   // アーケード北端 z（City.STREET_Z_MAX 相当）
  var ARCADE_BEAM_Y = 12; // 梁下の高さ
  var ARCADE_ROOF_Y = 13; // 帯屋根の高さ

  /**
   * 業種テーブル（DESIGN.md §6 に準拠）。
   * 看板テキストは「業種名・名物名」のみ。実在店名・チェーン名・ロゴ・実在人物は使わない。
   * W0..W5（西列）, E0..E5（東列）の順に割り当てる。
   */
  var KINDS = ['串カツ', 'ホルモン', '居酒屋', 'ふぐ', '将棋クラブ', 'たこ焼',
               '立ち飲み', '喫茶', 'うどん', '射的', 'カラオケ', '甘味'];

  // -------------------------------------------------------------------------
  //  業種ごとの「情報パネル本文」「看板色」「ネオン色」テーブル
  //  body は DESIGN.md §12 の固定文言（ある業種）を優先。それ以外は親しみ解説を用意。
  //  ※ HTMLタグ不可・改行は \n（UI 側が white-space:pre-line で表示）。
  // -------------------------------------------------------------------------
  var SHOP_DATA = {
    '串カツ': {
      kind: 'shop',
      sign: { bg: '#c01a1a', fg: '#fff3c0', border: '#ffd24a' },
      neon: '#ff3b30',
      body:
        'サクッと揚げた串を、共用のソースにくぐらせて一口。\n' +
        'お約束は「ソースの二度づけ禁止」。みんなで使うソースだから、ひと串につき一回だけ。\n' +
        'カウンターで立ち食い、瓶ビール片手にワイワイ——新世界の名物グルメです。'
    },
    'ホルモン': {
      kind: 'shop',
      sign: { bg: '#7a1f12', fg: '#ffe39a', border: '#ffb347' },
      neon: '#ff7a1a',
      body:
        '鉄板やコンロでジュ〜ッと焼く、もつの旨み。\n' +
        'こってり甘辛いタレと、ビールやハイボールの相性は反則級。\n' +
        '煙とにおいと笑い声が路地にあふれる、下町の夜の定番です。'
    },
    '居酒屋': {
      kind: 'shop',
      sign: { bg: '#1b3a5c', fg: '#ffe9a8', border: '#ffd24a' },
      neon: '#ffcf33',
      body:
        '今日のおすすめは黒板にチョークでびっしり。\n' +
        'とりあえずの一杯から、しめの一品まで。\n' +
        '赤提灯をくぐれば、知らない人ともすぐ仲良し——大阪の社交場です。'
    },
    'ふぐ': {
      kind: 'shop',
      sign: { bg: '#0e3a52', fg: '#fff8e8', border: '#7fd4e8' },
      neon: '#19d2e8',
      body:
        '大阪はふぐ消費量が日本トップクラス。新世界には大きなふぐの立体看板がよく似合います。\n' +
        '薄づくり、てっちり（鍋）、唐揚げ——寒くなるほどおいしくなる冬の味覚。\n' +
        'ぷっくり膨らんだ看板を見上げれば、それだけで“大阪に来た感”が爆上がりです。'
    },
    '将棋クラブ': {
      kind: 'shop',
      sign: { bg: '#3a2a18', fg: '#ffe7b0', border: '#caa15a' },
      neon: '#ffb347',
      body:
        '新世界といえば、将棋や囲碁を指す“縁台文化”。\n' +
        '昼下がり、常連さんがパチリパチリと駒を打つ音が響きます。\n' +
        '勝った負けたで一喜一憂——観戦するだけでも楽しい、街の社交場です。'
    },
    'たこ焼': {
      kind: 'shop',
      sign: { bg: '#b8141a', fg: '#fff2b0', border: '#ffd24a' },
      neon: '#ff2d6f',
      body:
        '外はカリッ、中はとろ〜り。鉄板の上でくるくる返す名人芸。\n' +
        'ソース・青のり・かつお節がふわり、湯気まで美味しい。\n' +
        '焼きたてを頬張れば、口の中は小さなお祭り騒ぎです。'
    },
    '立ち飲み': {
      kind: 'shop',
      sign: { bg: '#244a2e', fg: '#fff2c0', border: '#ffd24a' },
      neon: '#5ad65a',
      body:
        'イスはなし、肩ひじ張らずにサクッと一杯。\n' +
        'コップ酒に小皿のアテ、ワンコインでほろ酔い気分。\n' +
        '隣の常連さんとの世間話まで含めて、これぞ下町の立ち飲みです。'
    },
    '喫茶': {
      kind: 'shop',
      sign: { bg: '#5a3a22', fg: '#ffe9c8', border: '#caa15a' },
      neon: '#ffae42',
      body:
        '深い赤のソファに、ナポリタンとクリームソーダ。\n' +
        '時間がゆっくり流れる、昭和レトロな純喫茶。\n' +
        'マスターの淹れる一杯で、街歩きの足をちょっと休めましょう。'
    },
    'うどん': {
      kind: 'shop',
      sign: { bg: '#1b3a5c', fg: '#fff6df', border: '#ffd24a' },
      neon: '#ffd633',
      body:
        '昆布の効いた、やさしい色のお出汁。\n' +
        'つるりとしたうどんに、甘いおあげをのせた“きつね”が大阪の定番。\n' +
        'ほっと一息、体の芯からあたたまる一杯です。'
    },
    '射的': {
      kind: 'shop',
      sign: { bg: '#7a1240', fg: '#ffe39a', border: '#ffd24a' },
      neon: '#ff2d6f',
      body:
        'コルク銃を構えて、棚の景品をねらい撃ち。\n' +
        '当たった、外れたで一喜一憂——大人も子どもも夢中になる縁日気分。\n' +
        'ちょっとレトロな遊び場が、横丁にはよく似合います。'
    },
    'カラオケ': {
      kind: 'shop',
      sign: { bg: '#3a1860', fg: '#ffe9ff', border: '#ff9ad6' },
      neon: '#c44dff',
      body:
        '歌えば心はスッキリ、夜はこれから本番です。\n' +
        '十八番を一曲、ハモって大合唱。\n' +
        'ネオンがまたたく路地の、にぎやかな夜の楽しみどころ。'
    },
    '甘味': {
      kind: 'shop',
      sign: { bg: '#a8324f', fg: '#fff2e0', border: '#ffd24a' },
      neon: '#ff6f9c',
      body:
        'あんみつ、ぜんざい、みたらし団子。\n' +
        '甘いものは別腹、というのが大阪の合言葉。\n' +
        '食べ歩きの〆に、ほっとやさしい甘さでひと休みです。'
    }
  };

  // §6.1 通り（ジャンジャン横丁）情報 — DESIGN.md §12.2 の固定文言
  var STREET_INFO = {
    name: 'ジャンジャン横丁',
    kind: 'street',
    tag: 'ジャンジャン横丁',
    body:
      '屋根付きのアーケードに、串カツ・ホルモン・将棋クラブがぎゅっと並ぶ細い商店街。\n' +
      '三味線の音が「ジャンジャン」鳴っていたのが名前の由来とも言われます。\n' +
      '昼は買い物客、夜は赤提灯。歩くだけで元気をもらえる、大阪・下町のど真ん中です。'
  };

  // 雑居ビルの壁ベース色（下町感を出すためにくすんだトーンをばらす）
  var WALL_BASES = ['#8a7f74', '#7d7a82', '#9a8b6e', '#6f6a64', '#88766a', '#7a8076'];

  // -------------------------------------------------------------------------
  //  小ヘルパ
  // -------------------------------------------------------------------------

  // 擬似乱数（毎回同じ街にするため固定シード。Math.random は使わない＝再現性確保）
  var _seed = 20260530;
  function rng() {
    // xorshift32
    _seed ^= _seed << 13; _seed |= 0;
    _seed ^= _seed >>> 17;
    _seed ^= _seed << 5;  _seed |= 0;
    return ((_seed >>> 0) % 100000) / 100000; // 0..1
  }
  function randRange(a, b) { return a + (b - a) * rng(); }
  function randInt(a, b) { return Math.floor(randRange(a, b + 1)); }

  // 夜に切替えたいマテリアルを覚えておき、onNight でまとめて強度変更するためのレコード
  // rec = { mat, nightI, dayI }（emissiveIntensity の夜/昼値）
  function pushEmissive(list, mat, nightI, dayI) {
    list.push({ mat: mat, nightI: nightI, dayI: dayI });
  }
  function applyEmissive(list, night) {
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      r.mat.emissiveIntensity = night ? r.nightI : r.dayI;
    }
  }

  // -------------------------------------------------------------------------
  //  袖看板（壁から通りに突き出す薄い箱看板）
  //  facing: 'west'（西列ビル＝看板は東＝通り側=+X方向へ突き出す）/ 'east'（東列＝-X側へ）
  //  戻り値: { mesh, emissiveRecs[] }
  // -------------------------------------------------------------------------
  function makeSleeveSign(text, shopInfo, facing, bldgW, bldgH, atY) {
    var grp = new THREE.Group();
    var recs = [];

    var signW = 2.4;             // 看板の幅（X方向＝突き出す向きの厚みではなく板の面）
    var signH = Math.min(3.2, bldgH * 0.5);
    var panelThick = 0.35;       // 板の厚み

    // 看板テクスチャ（縦書き）
    var sbTex = Tex.signboard(text, shopInfo.sign.bg, shopInfo.sign.fg,
      { vertical: true, border: shopInfo.sign.border, w: 256, h: 384 });

    // 看板パネル本体（両面に絵が出るよう side:DoubleSide）
    var sbMat = new THREE.MeshStandardMaterial({
      map: sbTex, roughness: 0.7, metalness: 0.05,
      emissive: 0xffffff, emissiveMap: sbTex, emissiveIntensity: 0.0,
      side: THREE.DoubleSide
    });
    // 夜は看板自体もうっすら自照（昼は 0）
    pushEmissive(recs, sbMat, 0.35, 0.0);

    // パネルは「通りに沿う面（ZY平面）」を持つ薄い箱：X=厚み, Y=高さ, Z=板幅
    var panel = new THREE.Mesh(new THREE.BoxGeometry(panelThick, signH, signW), sbMat);
    grp.add(panel);

    // 看板を支える腕（短いシリンダー）
    var armMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, metalness: 0.3 });
    var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), armMat);
    arm.rotation.z = Math.PI / 2; // 横向き
    grp.add(arm);

    // 夜のネオン縁取り（看板の手前にネオン文字面を薄く重ねる）
    var neonTex = Tex.neon(text, shopInfo.neon, { w: 256, h: 256 });
    var neonMat = new THREE.MeshBasicMaterial({
      map: neonTex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, opacity: 1.0
    });
    var neonPlane = new THREE.Mesh(new THREE.PlaneGeometry(signW * 0.92, signH * 0.92), neonMat);
    // 板の面（ZY平面）に合わせて Y軸90°回転（法線をX向きに）
    neonPlane.rotation.y = Math.PI / 2;
    grp.add(neonPlane);
    // ネオンは夜だけ見せる。onNight でopacityを切替えたいので別管理
    grp.userData.neonMat = neonMat;

    // 突き出し方向に応じて配置（壁面 x からアームぶん外側へ）
    var dir = (facing === 'west') ? 1 : -1; // 西列ビルは +X（通り側）へ
    var outX = (bldgW / 2) + 1.0;           // 壁面から少し外
    grp.position.set(dir * outX, atY, 0);
    arm.position.set(-dir * 0.6, 0, 0);     // 腕は壁側へ
    neonPlane.position.set(dir * (panelThick / 2 + 0.03), 0, 0); // 板の外面手前

    grp.userData.emissiveRecs = recs;
    return grp;
  }

  // -------------------------------------------------------------------------
  //  壁面看板（ファサード正面に貼る平らな看板）。通り側（+X 西列 / -X 東列）の壁に貼る。
  // -------------------------------------------------------------------------
  function makeWallSign(text, shopInfo, facing, bldgW, bldgD, atY) {
    var grp = new THREE.Group();
    var recs = [];

    var w = Math.min(bldgD * 0.7, 6.5); // 看板の幅（Z方向に沿う）
    var h = 1.8;

    var sbTex = Tex.signboard(text, shopInfo.sign.bg, shopInfo.sign.fg,
      { vertical: false, border: shopInfo.sign.border, w: 384, h: 192 });
    var sbMat = new THREE.MeshStandardMaterial({
      map: sbTex, roughness: 0.7, metalness: 0.05,
      emissive: 0xffffff, emissiveMap: sbTex, emissiveIntensity: 0.0
    });
    pushEmissive(recs, sbMat, 0.3, 0.0);

    // ZY平面の板（法線X向き）。PlaneGeometry を Y回転。
    var panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sbMat);
    var dir = (facing === 'west') ? 1 : -1;
    panel.rotation.y = dir * Math.PI / 2; // 通り側を向く
    grp.add(panel);

    var outX = (bldgW / 2) + 0.06;
    grp.position.set(dir * outX, atY, 0);

    grp.userData.emissiveRecs = recs;
    return grp;
  }

  // -------------------------------------------------------------------------
  //  暖簾（のれん）を軒先に吊るす（平面、通り側を向く）
  // -------------------------------------------------------------------------
  function makeNoren(text, shopInfo, facing, bldgW, bldgD) {
    var w = Math.min(bldgD * 0.55, 4.5);
    var h = 1.3;
    var bg = shopInfo.sign.bg; // 店の色味に合わせる
    var norenTex = Tex.noren(text, bg);
    var mat = new THREE.MeshStandardMaterial({
      map: norenTex, roughness: 0.9, metalness: 0.0,
      transparent: true, side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    var dir = (facing === 'west') ? 1 : -1;
    mesh.rotation.y = dir * Math.PI / 2;
    var outX = (bldgW / 2) + 0.12;
    mesh.position.set(dir * outX, 2.6, 0); // 入口の高さ
    return mesh;
  }

  // -------------------------------------------------------------------------
  //  1棟の雑居ビルを構築
  //  spec = { x, z, kind, facing }
  //  戻り値: THREE.Group（userData.info / onNight 設定済み）
  // -------------------------------------------------------------------------
  function makeBuilding(spec) {
    var group = new THREE.Group();
    var shop = SHOP_DATA[spec.kind] || SHOP_DATA['居酒屋'];

    // --- 寸法をばらす（下町感）。幅は最大11を厳守（重なり防止） ---
    var w = Math.min(BLDG_W, randRange(9.5, 11.0));
    var d = Math.min(BLDG_D, randRange(8.5, 10.0));
    var floors = randInt(2, 5);
    var h = floors * randRange(3.0, 3.8) + 1.5; // 8〜20 程度に収まる
    if (h > 20) h = 20; if (h < 8) h = 8;

    // 夜に強度変更するマテリアルの収集箱
    var emissiveRecs = [];
    var neonMats = [];

    // --- 壁テクスチャ（昼用・夜用を1枚で兼ねる：emissiveMap に夜窓を使う）---
    var base = WALL_BASES[Math.abs((spec.x + spec.z)) % WALL_BASES.length];
    // 通常面マップ（昼の見た目）
    var wallMap = Tex.wall({ base: base, floors: floors, windows: true, night: false, w: 256, h: 512 });
    // 夜の窓発光マップ（窓だけが光る画像）を emissiveMap に
    var wallNight = Tex.wall({ base: base, floors: floors, windows: true, night: true, w: 256, h: 512 });

    var wallMat = new THREE.MeshStandardMaterial({
      map: wallMap, roughness: 0.85, metalness: 0.05,
      emissive: 0xfff2cc, emissiveMap: wallNight, emissiveIntensity: 0.0
    });
    // 夜は窓がしっかり灯る／昼は消える
    pushEmissive(emissiveRecs, wallMat, 0.9, 0.0);

    // 屋上面・底面はテクスチャなしの単色（窓が回り込まないように面ごとにマテリアル分け）
    var plainMat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.9, metalness: 0.03 });

    // BoxGeometry のマテリアル順は [+X,-X,+Y,-Y,+Z,-Z]
    // 側面4面（±X, ±Z）に wallMat、天面/底面に plainMat
    var mats = [wallMat, wallMat, plainMat, plainMat, wallMat, wallMat];
    var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    body.position.y = h / 2; // 底面を y=0 に
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // --- パラペット（屋上の縁取り。下町ビルらしい段差）---
    var parapetMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.9 });
    var parapet = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.6, d * 1.02), parapetMat);
    parapet.position.y = h + 0.3;
    parapet.castShadow = true;
    group.add(parapet);

    // --- 室外機・配管っぽい小ボックスを屋上にいくつか（任意の下町ディテール）---
    var unitMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.8, metalness: 0.2 });
    var nUnits = randInt(1, 2);
    for (var u = 0; u < nUnits; u++) {
      var uw = randRange(1.0, 1.8);
      var unit = new THREE.Mesh(new THREE.BoxGeometry(uw, 0.9, uw * 0.7), unitMat);
      unit.position.set(randRange(-w / 3, w / 3), h + 0.45 + 0.45, randRange(-d / 3, d / 3));
      unit.castShadow = true;
      group.add(unit);
    }

    // --- 看板群（ファサード上部に袖看板1〜2枚＋壁面看板1枚）---
    var sleeveTopY = Math.min(h - 1.5, h * 0.78);

    var sleeve1 = makeSleeveSign(spec.kind, shop, spec.facing, w, h, sleeveTopY);
    group.add(sleeve1);
    Array.prototype.push.apply(emissiveRecs, sleeve1.userData.emissiveRecs);
    if (sleeve1.userData.neonMat) neonMats.push(sleeve1.userData.neonMat);

    // 2枚目の袖看板（背の高いビルだけ。少し下に）
    if (h > 12) {
      var sleeve2 = makeSleeveSign(spec.kind, shop, spec.facing, w, h, sleeveTopY - 4.0);
      // 2枚目はZにずらして重ならないように
      sleeve2.position.z = randRange(-d * 0.25, d * 0.25);
      group.add(sleeve2);
      Array.prototype.push.apply(emissiveRecs, sleeve2.userData.emissiveRecs);
      if (sleeve2.userData.neonMat) neonMats.push(sleeve2.userData.neonMat);
    }

    // 壁面看板（1階の上あたり）
    var wallSign = makeWallSign(spec.kind, shop, spec.facing, w, d, 3.4);
    group.add(wallSign);
    Array.prototype.push.apply(emissiveRecs, wallSign.userData.emissiveRecs);

    // --- 暖簾（軒先）---
    var noren = makeNoren(spec.kind, shop, spec.facing, w, d);
    group.add(noren);

    // --- グループを所定位置へ ---
    group.position.set(spec.x, 0, spec.z);

    // --- 情報パネル契約（§1.3 / §6）---
    // name は DESIGN.md §12 の見出し表記に寄せる（串カツ→「串カツ屋」, ふぐ→「ふぐ料理」等）
    group.userData.info = {
      name: displayName(spec.kind),
      kind: shop.kind, // "shop"
      body: shop.body,
      tag: spec.kind
    };

    // --- 夜更新フック（看板/窓/ネオン emissiveIntensity 切替）---
    group.userData.onNight = function (flag) {
      applyEmissive(emissiveRecs, flag);
      for (var i = 0; i < neonMats.length; i++) {
        neonMats[i].opacity = flag ? 1.0 : 0.0;
        neonMats[i].visible = flag; // 昼は完全に消す
      }
    };
    // 初期は夜（City.night デフォルト true）。実際の適用は City.setNight 経由 or 下のbuild末尾で初期化。

    // 夜のネオン点滅アニメ（代表マテリアルを City.onUpdate で揺らす）
    // 個々の登録は build() でまとめて行う（updater 数を抑えるためビルごとに位相を持たせる）
    group.userData._neonMats = neonMats;
    group.userData._neonPhase = randRange(0, Math.PI * 2);

    // ネオン代表 PointLight（1棟1灯）。看板の少し外側・上部に暖色〜店色。
    var dir = (spec.facing === 'west') ? 1 : -1;
    var lightColor = hexToInt(shop.neon);
    group.userData._decoLightReq = {
      color: lightColor, intensity: 1.0, distance: 16,
      pos: { x: spec.x + dir * (w / 2 + 1.0), y: sleeveTopY, z: spec.z }
    };

    return group;
  }

  // 情報パネル見出し（DESIGN.md §12 の表記に寄せる）
  function displayName(k) {
    switch (k) {
      case '串カツ': return '串カツ屋';
      case 'ホルモン': return 'ホルモン焼';
      case 'ふぐ': return 'ふぐ料理';
      case 'たこ焼': return 'たこ焼';
      case '将棋クラブ': return '将棋クラブ';
      case '居酒屋': return '居酒屋';
      case '立ち飲み': return '立ち飲み';
      case '喫茶': return '喫茶店';
      case 'うどん': return 'うどん屋';
      case '射的': return '射的';
      case 'カラオケ': return 'カラオケ';
      case '甘味': return '甘味処';
      default: return k;
    }
  }

  // "#rrggbb" → 0xrrggbb
  function hexToInt(s) {
    return parseInt(s.replace('#', '0x'), 16);
  }

  // -------------------------------------------------------------------------
  //  アーケード（屋根アーチ＋吊り看板）を構築
  //  戻り値: THREE.Group（情報なし＝register しない）
  // -------------------------------------------------------------------------
  function makeArcade() {
    var grp = new THREE.Group();

    var halfW = (City.STREET_WIDTH || 18) / 2; // ±9
    var zMin = (typeof City.STREET_Z_MIN === 'number') ? City.STREET_Z_MIN : ARCADE_Z_MIN;
    var zMax = (typeof City.STREET_Z_MAX === 'number') ? City.STREET_Z_MAX : ARCADE_Z_MAX;
    var span = zMax - zMin;

    // 鉄骨マテリアル（赤緑のレトロな横丁トラス色）
    var steelMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4f, roughness: 0.7, metalness: 0.4 });
    var steelRed = new THREE.MeshStandardMaterial({ color: 0x9a2e2e, roughness: 0.7, metalness: 0.4 });

    // --- 両脇の縦柱（西 x=-halfW-? / 東 x=+halfW）を一定間隔で立てる ---
    var nBays = 7; // アーチの数
    var pillarMatPair = [steelMat, steelRed];
    var step = span / nBays;
    for (var b = 0; b <= nBays; b++) {
      var z = zMin + step * b;
      for (var s = 0; s < 2; s++) {
        var px = (s === 0) ? -halfW : halfW;
        var pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, ARCADE_BEAM_Y, 0.5), pillarMatPair[b % 2]);
        pillar.position.set(px, ARCADE_BEAM_Y / 2, z);
        pillar.castShadow = true;
        grp.add(pillar);
      }
    }

    // --- アーチ（半円の梁）：両脇柱の頂点をつなぐ。TorusGeometry の半円弧を使う ---
    var archMat = steelRed;
    for (var a = 0; a <= nBays; a++) {
      var az = zMin + step * a;
      // 半円アーチ（XY平面の半円を、通りをまたぐようにZ位置へ）
      var arch = new THREE.Mesh(
        new THREE.TorusGeometry(halfW, 0.22, 8, 24, Math.PI), // 半円
        (a % 2 === 0) ? archMat : steelMat
      );
      arch.position.set(0, ARCADE_BEAM_Y, az);
      // Torus は XY平面に生成。半円が「上半分」になるよう、デフォルト（0..π）でOK。
      grp.add(arch);
    }

    // --- 縦方向の桁（梁）：両脇の柱頭を前後につなぐ ---
    var beamGeo = new THREE.BoxGeometry(0.3, 0.3, span);
    for (var s2 = 0; s2 < 2; s2++) {
      var bx = (s2 === 0) ? -halfW : halfW;
      var beam = new THREE.Mesh(beamGeo, steelMat);
      beam.position.set(bx, ARCADE_BEAM_Y, zMin + span / 2);
      grp.add(beam);
    }
    // 中央のむね桁
    var ridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, span), steelRed);
    ridge.position.set(0, ARCADE_ROOF_Y + halfW * 0.0 + 0.0, zMin + span / 2);
    // アーチ頂点（y = ARCADE_BEAM_Y + halfW）に合わせる
    ridge.position.y = ARCADE_BEAM_Y + halfW;
    grp.add(ridge);

    // --- 半透明の帯屋根（雨よけ）：通りの上に薄いかまぼこ状の屋根 ---
    // アーチ梁（半円トーラス）と同じ profile に沿う“屋根帯”を、3枚のパネルで近似する。
    // 中央の水平天板＋左右の傾斜板で、緩いかまぼこ屋根に見せる（回転の曖昧さを排除）。
    var roofMat = new THREE.MeshStandardMaterial({
      color: 0xdfe6ea, roughness: 0.6, metalness: 0.0,
      transparent: true, opacity: 0.25, side: THREE.DoubleSide,
      depthWrite: false
    });
    var ridgeY = ARCADE_BEAM_Y + halfW;     // 屋根の頂点（アーチ頂点と一致）
    var roofZc = zMin + span / 2;

    // 中央天板（水平・幅は通りの中央 ~ halfW 分）
    var topPanel = new THREE.Mesh(new THREE.PlaneGeometry(halfW, span), roofMat);
    topPanel.rotation.x = -Math.PI / 2;     // 水平
    topPanel.position.set(0, ridgeY, roofZc);
    grp.add(topPanel);

    // 左右の傾斜板（頂点 → 柱頭(±halfW, BEAM_Y) へ降りる斜面）
    // 斜面の長さと傾きを算出
    var dx = halfW - halfW / 2;             // 中央天板端(±halfW/2) から軒(±halfW) までの水平距離
    var dy = ridgeY - ARCADE_BEAM_Y;        // その間の高低差
    var slopeLen = Math.sqrt(dx * dx + dy * dy);
    var slopeAng = Math.atan2(dy, dx);      // 水平からの傾き
    for (var sp = 0; sp < 2; sp++) {
      var sgn = (sp === 0) ? -1 : 1;        // 左(-X) / 右(+X)
      var slope = new THREE.Mesh(new THREE.PlaneGeometry(slopeLen, span), roofMat);
      // 手順: ①X軸-90°で水平化（長さ=幅spanがZ方向, 幅slopeLenがX方向, 法線=+Y）
      //       ②Z軸回りに傾けて屋根勾配を付ける（X方向の幅が軒へ向かって下る）
      slope.rotation.order = 'XYZ';
      slope.rotation.x = -Math.PI / 2;
      slope.rotation.z = -sgn * slopeAng;   // 軒側（外側）へ下る勾配
      // 斜面の中点を配置（中央天板端と軒の中間）
      var midX = sgn * (halfW / 2 + dx / 2);
      var midY = ridgeY - dy / 2;
      slope.position.set(midX, midY, roofZc);
      grp.add(slope);
    }

    // --- アーケード入口の大アーチ看板（南端・北端に「ジャンジャン横丁」風の横断幕）---
    // ※ 実在名は使わないが、横丁の“通り名”は固有名詞ではなく一般的な呼称としてOK（DESIGN.md §12.2準拠）
    var gateTex = Tex.signboard('ジャンジャン横丁', '#b8141a', '#fff2b0',
      { vertical: false, border: '#ffd24a', w: 768, h: 192 });
    var gateMat = new THREE.MeshStandardMaterial({
      map: gateTex, roughness: 0.7, metalness: 0.1,
      emissive: 0xffffff, emissiveMap: gateTex, emissiveIntensity: 0.0,
      side: THREE.DoubleSide
    });
    var gateW = halfW * 2 + 1;
    var gate = new THREE.Mesh(new THREE.PlaneGeometry(gateW, 2.6), gateMat);
    gate.position.set(0, ARCADE_BEAM_Y - 1.2, zMin + 0.3); // 南端入口
    grp.add(gate);

    // 北端側にもう一枚（通天閣側）
    var gateN = gate.clone();
    gateN.material = gateMat; // 同マテリアル共有でOK（夜更新も一括）
    gateN.position.set(0, ARCADE_BEAM_Y - 1.2, zMax - 0.3);
    gateN.rotation.y = Math.PI; // 反対向き
    grp.add(gateN);

    // --- アーケードから吊り下げる小さな吊り看板（通り中央に等間隔）---
    var hangRecs = []; // 夜更新用（emissiveIntensity レコード）
    var hangKinds = ['串カツ', 'ホルモン', 'ふぐ', '将棋', 'たこ焼', '甘味', '酒'];
    for (var hk = 1; hk < nBays; hk++) {
      var hz = zMin + step * hk;
      var word = hangKinds[(hk - 1) % hangKinds.length];
      var hcol = ['#c01a1a', '#1b3a5c', '#0e3a52', '#3a2a18', '#b8141a', '#a8324f', '#7a1f12'][(hk - 1) % 7];
      var hsbTex = Tex.signboard(word, hcol, '#fff3c0', { vertical: true, border: '#ffd24a', w: 192, h: 256 });
      var hsbMat = new THREE.MeshStandardMaterial({
        map: hsbTex, roughness: 0.7, metalness: 0.05,
        emissive: 0xffffff, emissiveMap: hsbTex, emissiveIntensity: 0.0,
        side: THREE.DoubleSide
      });
      pushEmissive(hangRecs, hsbMat, 0.4, 0.0);
      // 通りに沿う面（法線X）にしたいが、中央吊りは正面（法線Z）でOK
      var hsign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.1), hsbMat);
      hsign.position.set(0, ARCADE_BEAM_Y - 3.2, hz);
      grp.add(hsign);

      // 吊り紐
      var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), steelMat);
      cord.position.set(0, ARCADE_BEAM_Y - 2.0, hz);
      grp.add(cord);
    }

    // 夜更新フック（アーケード看板群）をグループに持たせる
    grp.userData._arcadeEmissive = hangRecs;
    grp.userData._gateMat = gateMat;
    // gateMat も夜は自照させる
    pushEmissive(hangRecs, gateMat, 0.45, 0.0);

    return grp;
  }

  // -------------------------------------------------------------------------
  //  通りの“透明クリック板”（ジャンジャン横丁の情報を持つ・kind:"street"）
  //  地面ギリギリに水平な薄板を置き、ここをクリックすると横丁情報が出る。
  // -------------------------------------------------------------------------
  function makeStreetClickBoard() {
    var halfW = (City.STREET_WIDTH || 18) / 2;
    var zMin = (typeof City.STREET_Z_MIN === 'number') ? City.STREET_Z_MIN : ARCADE_Z_MIN;
    var zMax = (typeof City.STREET_Z_MAX === 'number') ? City.STREET_Z_MAX : ARCADE_Z_MAX;
    var span = zMax - zMin;

    var group = new THREE.Group();
    // 完全透明（見た目に出さない）が Raycast には当たる板
    var mat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide
    });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, span), mat);
    plane.rotation.x = -Math.PI / 2;       // 水平
    plane.position.set(0, 0.05, zMin + span / 2); // 床のすぐ上
    group.add(plane);

    group.userData.info = {
      name: STREET_INFO.name,
      kind: STREET_INFO.kind, // "street"
      body: STREET_INFO.body,
      tag: STREET_INFO.tag
    };
    group.userData.onNight = function () { /* 通りクリック板は発光なし */ };
    return group;
  }

  // -------------------------------------------------------------------------
  //  window.Buildings
  // -------------------------------------------------------------------------
  window.Buildings = {

    // 業種テーブル（DESIGN.md §6 と一致）
    KINDS: KINDS,

    /**
     * ジャンジャン横丁のアーケード＋雑居ビル12棟を §2.2 の座標に建てる。
     * @returns {THREE.Group} 全建物＋アーケードを束ねた親Group
     */
    build: function () {
      // シード初期化（毎回同じ街にする）
      _seed = 20260530;

      var root = new THREE.Group();
      root.name = 'Buildings';

      // 全棟のネオン点滅をまとめて1つの updater で回すための収集箱
      var allNeonGroups = [];
      // 全棟のグループ（onNight 一括初期化用）
      var registeredGroups = [];

      // --- 12棟を建てる（西列 W0..W5 → KINDS[0..5], 東列 E0..E5 → KINDS[6..11]）---
      for (var i = 0; i < Z_CENTERS.length; i++) {
        // 西列
        var wKind = KINDS[i];        // 0..5
        var wSpec = { x: WEST_X, z: Z_CENTERS[i], kind: wKind, facing: 'west' };
        var wGroup = makeBuilding(wSpec);
        root.add(wGroup);
        City.register(wGroup);       // 情報登録（scene.add は root をまとめて行う）
        registeredGroups.push(wGroup);
        allNeonGroups.push(wGroup);

        // 東列
        var eKind = KINDS[i + 6];    // 6..11
        var eSpec = { x: EAST_X, z: Z_CENTERS[i], kind: eKind, facing: 'east' };
        var eGroup = makeBuilding(eSpec);
        root.add(eGroup);
        City.register(eGroup);
        registeredGroups.push(eGroup);
        allNeonGroups.push(eGroup);
      }

      // --- アーケード（屋根アーチ＋吊り看板）。register しない ---
      var arcade = makeArcade();
      root.add(arcade);

      // --- 通りの透明クリック板（横丁情報）。register する ---
      var streetBoard = makeStreetClickBoard();
      root.add(streetBoard);
      City.register(streetBoard);
      registeredGroups.push(streetBoard);

      // --- ネオン代表 PointLight を予算内で配置（1棟1灯）---
      // City.addDecoLight は MAX_POINTLIGHTS 超過で null を返す（その場合は emissive 任せ）。
      for (var k = 0; k < allNeonGroups.length; k++) {
        var req = allNeonGroups[k].userData._decoLightReq;
        if (req && typeof City.addDecoLight === 'function') {
          City.addDecoLight(req.color, req.intensity, req.distance, req.pos);
        }
      }

      // --- ネオン点滅アニメ（全棟＋アーケードを1つの updater で）---
      // 夜のみ動く。City.night を毎フレーム参照して昼は静かに。
      if (typeof City.onUpdate === 'function') {
        City.onUpdate(function (dt, t) {
          var isNight = !!City.night;
          // ビルのネオン：店ごとの位相でゆらゆら明滅
          for (var b = 0; b < allNeonGroups.length; b++) {
            var g = allNeonGroups[b];
            var mats = g.userData._neonMats;
            if (!mats || mats.length === 0) continue;
            if (!isNight) {
              // 昼は消灯（onNight 側でも消すが念のため）
              for (var mi = 0; mi < mats.length; mi++) { mats[mi].opacity = 0.0; }
              continue;
            }
            var ph = g.userData._neonPhase || 0;
            // 0.65〜1.0 の範囲でゆらぎ＋たまにチラつき
            var base = 0.82 + 0.18 * Math.sin(t * 2.2 + ph);
            // まれな瞬きノイズ
            var flick = (Math.sin(t * 13.0 + ph * 3.1) > 0.92) ? 0.35 : 1.0;
            var op = base * flick;
            if (op < 0) op = 0; if (op > 1) op = 1;
            for (var m = 0; m < mats.length; m++) {
              mats[m].opacity = op;
              mats[m].visible = true;
            }
          }
        });
      }

      // --- root を scene へ ---
      City.scene.add(root);

      // --- 初期昼夜状態を反映（City.night は init で true）---
      var initNight = (City.night !== undefined) ? !!City.night : true;
      for (var r = 0; r < registeredGroups.length; r++) {
        if (typeof registeredGroups[r].userData.onNight === 'function') {
          registeredGroups[r].userData.onNight(initNight);
        }
      }
      // アーケード看板の初期反映
      if (arcade.userData._arcadeEmissive) {
        applyEmissive(arcade.userData._arcadeEmissive, initNight);
      }
      // アーケード自体の夜更新フック（City.setNight 伝播はしないので、別途参照できるよう root に保持）
      arcade.userData.onNight = function (flag) {
        if (arcade.userData._arcadeEmissive) applyEmissive(arcade.userData._arcadeEmissive, flag);
      };
      // City.setNight が伝播するのは register 済み objects のみ。
      // アーケードは register しないため、City の昼夜に追従させるための updater を1つ追加。
      if (typeof City.onUpdate === 'function') {
        var _lastNight = initNight;
        City.onUpdate(function () {
          if (City.night !== _lastNight) {
            _lastNight = !!City.night;
            arcade.userData.onNight(_lastNight);
          }
        });
      }

      return root;
    }
  };

})();

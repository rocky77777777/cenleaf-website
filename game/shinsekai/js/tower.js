/* =====================================================================
 * tower.js  ―  window.Tower
 * 大阪・新世界のシンボル「通天閣」を Three.js (r137 / グローバル THREE) で構築する。
 *
 * 契約（DESIGN.md §5 / §3.1 / §12.1）:
 *   - Group を作り City.TOWER_POS(0,0,28) に配置し、City.scene.add + City.register する。
 *   - 下から: 四角い台座(四本脚)→四角錐台(下段)→中段の張り出し展望台→四角錐台(上段)
 *             →上段の丸い展望台→頂部の円筒広告塔＋ネオンリング→アンテナ。
 *   - 鉄骨は MeshStandardMaterial(#9a4a2a 赤錆, roughness0.7) ＋ Tex.tower("truss")。
 *   - 展望台帯 / 頂部リング / 縦ネオンラインは emissive(暖色/白) ＋ emissiveMap。
 *     夜 emissiveIntensity≈1.2 / 昼≈0.15（userData.onNight で切替）。
 *   - 頂部リングは色相が時間で回る（City.onUpdate で hue 更新）。
 *   - 代表 PointLight を 頂部(0,52,28) と 中段(0,30,28) に City.addDecoLight で（暖色）。
 *   - group.userData.info = §12.1 の通天閣情報。castShadow=true / receiveShadow=false。
 *   - 全高 TOWER_TOTAL_H = 56。
 *
 * 公開: window.Tower = { build() }
 * 依存: window.City, window.Tex, グローバル THREE
 * 禁止: import/export/require/fetch/外部画像・フォント。
 * ===================================================================== */
(function () {
  'use strict';

  // ---- 寸法定数（DESIGN.md §3.1 の表に厳密一致）-------------------------
  // 各パーツの y 範囲。四角錐台は CylinderGeometry(topR, botR, h, 4) を使い、
  // 半径は「対角（コーナーまで）」半径として指定する（§3.1 の "botR 10(対角)" 準拠）。
  var DIM = {
    BASE:    { yBottom: 0,  yTop: 8,  side: 14 },                 // 基部・台座+四本脚 (0〜8) 一辺14
    LOWER:   { yBottom: 8,  yTop: 24, botR: 10, topR: 6, h: 16 }, // 下段 四角錐台 (8〜24)
    MIDDECK: { yBottom: 24, yTop: 27, side: 13, thick: 1.5 },     // 中段 展望台リング (24〜27) 一辺13
    UPPER:   { yBottom: 27, yTop: 41, botR: 6,  topR: 3, h: 14 }, // 上段 四角錐台 (27〜41)
    UPDECK:  { yBottom: 41, yTop: 44, R: 4,  h: 3 },              // 上段展望台 (41〜44) 丸
    ADTOWER: { yBottom: 44, yTop: 50, R: 3,  h: 6 },              // 頂部 広告塔(丸) (44〜50)
    ANTENNA: { yBottom: 50, yTop: 56, R: 0.3, h: 6 }              // アンテナ (50〜56)
  };
  var TOTAL_H = 56; // = City.TOWER_TOTAL_H（参考）

  // 夜/昼の発光強度（契約値）。
  var EMI_NIGHT = 1.2;
  var EMI_DAY = 0.15;

  // ---- §12.1 情報パネル文言（textContent で出すので HTML 禁止・改行は \n）----
  var INFO = {
    name: '通天閣',
    kind: 'landmark',
    body:
      '新世界のど真ん中にそびえる、街のシンボルタワー。\n' +
      '四角い鉄塔がキュッと絞られて、てっぺんには丸い展望塔。\n' +
      '夜になるとライトアップとネオンリングが灯って、下町の夜空をやさしく照らします。\n' +
      '足元から見上げると、なんだか元気が出る——そんな存在です。',
    tag: '通天閣'
  };

  // この build 内で集めた「夜だけ強く光る」マテリアル群。onNight でまとめて切替える。
  var _emissiveMats = [];
  // 頂部ネオンリングのマテリアル群（色相を毎フレーム回す対象）。
  var _hueRingMats = [];
  // City.onUpdate を二重登録しないためのガード。
  var _updaterBound = false;

  // ---------------------------------------------------------------------
  // 内部ヘルパ群
  // ---------------------------------------------------------------------

  /** Tex.tower(part) を安全に呼ぶ。Tex が無い/失敗しても build を止めない。 */
  function texTower(part, night) {
    try {
      if (window.Tex && typeof window.Tex.tower === 'function') {
        return window.Tex.tower(part, { night: !!night });
      }
    } catch (e) {
      // テクスチャ単体の失敗は致命ではない（無地マテリアルで続行）。
      console.warn('[Tower] Tex.tower("' + part + '") に失敗:', e);
    }
    return null;
  }

  /** Tex.neon(text,color) を安全に呼ぶ（emissiveMap 用途）。 */
  function texNeon(text, color) {
    try {
      if (window.Tex && typeof window.Tex.neon === 'function') {
        return window.Tex.neon(text, color, { w: 256, h: 128 });
      }
    } catch (e) {
      console.warn('[Tower] Tex.neon に失敗:', e);
    }
    return null;
  }

  /** 鉄骨トラス用の Standard マテリアルを作る（夜/昼で同一・テクスチャの窓は emissive 側で担当）。 */
  function makeIronMaterial(night) {
    var map = texTower('truss', night);
    var mat = new THREE.MeshStandardMaterial({
      color: 0x9a4a2a,       // 赤錆色（通天閣の鉄骨イメージ）
      roughness: 0.72,
      metalness: 0.18,
      map: map || null
    });
    return mat;
  }

  /**
   * 発光帯/リング/縦ラインの emissive マテリアルを作って登録する。
   * 夜は EMI_NIGHT、昼は EMI_DAY。City.night を見て初期値を決める。
   * @param {object} o {color, emissive, map, hueRing}
   *   color    : ベース色（消灯時の見た目）
   *   emissive : 発光色
   *   map      : map（任意）
   *   emissiveMap : emissiveMap（任意・neon等）
   *   hueRing  : true なら色相回転対象に登録
   */
  function makeEmissiveMaterial(o) {
    o = o || {};
    var isNight = !!(window.City && window.City.night);
    var mat = new THREE.MeshStandardMaterial({
      color: (o.color != null) ? o.color : 0x331a10,
      emissive: (o.emissive != null) ? o.emissive : 0xffce6a,
      emissiveIntensity: isNight ? EMI_NIGHT : EMI_DAY,
      roughness: 0.45,
      metalness: 0.1,
      map: o.map || null,
      emissiveMap: o.emissiveMap || null,
      transparent: !!o.transparent,
      opacity: (o.opacity != null) ? o.opacity : 1.0
    });
    _emissiveMats.push(mat);
    if (o.hueRing) _hueRingMats.push(mat);
    return mat;
  }

  /**
   * 中空の四角フレーム（展望台の手すり/帯）を作る。XZ 平面上の正方形リングを
   * 厚み thick の Box 4本で構成し、Group で返す。中心は原点、上面が y=topY。
   * @param {number} side    リング外形の一辺
   * @param {number} barW    桟の幅（XまたはZ方向の太さ）
   * @param {number} barH    桟の高さ（Y）
   * @param {number} yCenter 桟の中心 y
   * @param {THREE.Material} mat
   * @returns {THREE.Group}
   */
  function makeSquareRing(side, barW, barH, yCenter, mat) {
    var g = new THREE.Group();
    var half = side / 2;
    // 南北（Z方向に伸びる）2本：±X に配置、長さは side
    var nsGeo = new THREE.BoxGeometry(barW, barH, side);
    // 東西（X方向に伸びる）2本：±Z に配置、長さは side（角の重複は許容＝見た目良し）
    var ewGeo = new THREE.BoxGeometry(side, barH, barW);
    var positions = [
      { geo: nsGeo, x: half - barW / 2,  z: 0 },
      { geo: nsGeo, x: -half + barW / 2, z: 0 },
      { geo: ewGeo, x: 0, z: half - barW / 2 },
      { geo: ewGeo, x: 0, z: -half + barW / 2 }
    ];
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      var m = new THREE.Mesh(p.geo, mat);
      m.position.set(p.x, yCenter, p.z);
      m.castShadow = true;
      m.receiveShadow = false;
      g.add(m);
    }
    return g;
  }

  /**
   * 四角錐台（テーパーする鉄塔本体）を作る。CylinderGeometry の radialSegments=4 で
   * 四角形断面にし、Y軸まわりに 45° 回して「平らな面」を ±X / ±Z（=南北東西）に向ける。
   * 実物の通天閣は正面（南）に平らな面が来るので、カメラ（南）から見て四角く見える。
   * @param {object} d {botR, topR, h, yBottom}  ※半径は対角（コーナー）半径
   * @param {THREE.Material} mat
   * @returns {THREE.Mesh}
   */
  function makeSquareFrustum(d, mat) {
    // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
    var geo = new THREE.CylinderGeometry(d.topR, d.botR, d.h, 4, 1, false);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 4; // 角を回して平らな面を正面（南北東西）へ
    mesh.position.y = d.yBottom + d.h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  }

  /**
   * 鉄塔の輪郭に沿う「縦のネオンライン」を作る（夜に光る帯）。
   * 四角錐台の4つの稜線（コーナー）に薄い発光板を立てかける。
   * @param {object} d {botR, topR, h, yBottom}
   * @returns {THREE.Group}
   */
  function makeVerticalNeon(d) {
    var g = new THREE.Group();
    var mat = makeEmissiveMaterial({
      color: 0x2a1208,
      emissive: 0xffdf8a, // 暖白の縦ライン
      transparent: false
    });
    // コーナー方向（45°ずつ）。frustum を 45° 回しているので、稜線は ±X / ±Z 軸上に来る。
    var dirs = [
      { ax: 1, az: 0 },
      { ax: -1, az: 0 },
      { ax: 0, az: 1 },
      { ax: 0, az: -1 }
    ];
    // 縦ラインは細長い板。高さ＝h、幅＝細く、平均半径ぶん外側に出す。
    var avgR = (d.botR + d.topR) / 2;
    var lineGeo = new THREE.BoxGeometry(0.5, d.h * 0.98, 0.5);
    for (var i = 0; i < dirs.length; i++) {
      var m = new THREE.Mesh(lineGeo, mat);
      m.position.set(dirs[i].ax * avgR, d.yBottom + d.h / 2, dirs[i].az * avgR);
      m.castShadow = false;     // 細い装飾は影なし（負荷対策）
      m.receiveShadow = false;
      g.add(m);
    }
    return g;
  }

  // ---------------------------------------------------------------------
  // 公開 API
  // ---------------------------------------------------------------------
  window.Tower = {
    /**
     * 通天閣を構築して City.scene に add、City.register する。
     * @returns {THREE.Group} 構築したタワーGroup
     */
    build: function () {
      var City = window.City;
      if (!City || !City.scene) {
        console.error('[Tower] City / City.scene が未初期化です。City.init() の後に呼んでください。');
        return null;
      }

      var isNight = !!City.night;

      // build をやり直す場合に備え、収集配列をリセット。
      _emissiveMats = [];
      _hueRingMats = [];

      var group = new THREE.Group();
      group.name = 'tower';

      // 代表 PointLight（夜のライトアップ）を後で詰める配列。
      // onNight クロージャがこの“同一配列インスタンス”を参照するよう、ここで宣言しておく。
      var decoLights = [];

      // 共有の鉄骨マテリアル（全鉄塔パーツで使い回す）。
      var iron = makeIronMaterial(isNight);

      // =================================================================
      // (1) 基部：四角い土台 ＋ 四本脚（0〜8）
      //     一辺14の薄い土台プレートの上に、外側へ広がる4本脚で鉄塔を支える表現。
      // =================================================================
      (function buildBase() {
        var s = DIM.BASE.side;

        // 1-a 土台プレート（コンクリ基礎）— 地面に底面を置く（厚み1.2）
        var plinthH = 1.2;
        var plinthMat = new THREE.MeshStandardMaterial({
          color: 0x4a4a52, roughness: 0.9, metalness: 0.05
        });
        var plinth = new THREE.Mesh(new THREE.BoxGeometry(s, plinthH, s), plinthMat);
        plinth.position.y = plinthH / 2;
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        group.add(plinth);

        // 1-b 四本脚：外側下→内側上へ傾けた角柱。下段四角錐台の底(対角10)へ集まる。
        //     脚の足元は四隅(±half付近)、上端は中央寄り。
        var legH = DIM.BASE.yTop - plinthH;     // 8 - 1.2 = 6.8
        var legGeo = new THREE.BoxGeometry(1.6, legH, 1.6);
        var footOff = s / 2 - 1.4;              // 足元の四隅オフセット
        // 上端で集まる半径（下段錐台 botR=10 は対角半径＝平面上の各辺中央までは 10/√2≈7.07）
        var topOff = 4.2;
        var corners = [
          { x: footOff,  z: footOff },
          { x: -footOff, z: footOff },
          { x: footOff,  z: -footOff },
          { x: -footOff, z: -footOff }
        ];
        for (var i = 0; i < corners.length; i++) {
          var leg = new THREE.Mesh(legGeo, iron);
          // 足元位置に置いてから、内側上方へ少し傾ける。
          leg.position.set(corners[i].x, plinthH + legH / 2, corners[i].z);
          // 傾き：四隅から中心へ向くように X/Z 軸で僅かに回転。
          var leanX = (corners[i].z > 0 ? -1 : 1) * 0.16; // Z正の脚は -X軸回転で内側へ
          var leanZ = (corners[i].x > 0 ? 1 : -1) * 0.16;
          leg.rotation.x = leanX;
          leg.rotation.z = leanZ;
          leg.castShadow = true;
          leg.receiveShadow = false;
          group.add(leg);
        }

        // 1-c 脚どうしをつなぐ筋交い（前面の三角トラス感）。前後左右に1本ずつ斜め材。
        var braceGeo = new THREE.BoxGeometry(0.7, s * 0.92, 0.7);
        var braceY = plinthH + legH / 2;
        var braces = [
          { x: 0, z: footOff,  rotAxis: 'x', rot: Math.PI / 2 * 0.0, rotZ: 0,             tilt: 'z' },
          { x: 0, z: -footOff, rotAxis: 'x', rot: 0, rotZ: 0,                              tilt: 'z' },
          { x: footOff,  z: 0, rotAxis: 'z', rot: 0, rotZ: 0,                              tilt: 'x' },
          { x: -footOff, z: 0, rotAxis: 'z', rot: 0, rotZ: 0,                              tilt: 'x' }
        ];
        for (var b = 0; b < braces.length; b++) {
          var br = new THREE.Mesh(braceGeo, iron);
          br.position.set(braces[b].x, braceY, braces[b].z);
          // 面内で斜めに（X字の片側）。前後面は Z 軸回転、左右面は X 軸回転で斜めにする。
          if (braces[b].tilt === 'z') br.rotation.z = 0.5;
          else br.rotation.x = 0.5;
          br.castShadow = false;
          br.receiveShadow = false;
          group.add(br);
        }
      })();

      // =================================================================
      // (2) 下段 四角錐台（8〜24）— 鉄骨格子マテリアル、平らな面を正面へ
      // =================================================================
      var lowerFrustum = makeSquareFrustum(DIM.LOWER, iron);
      group.add(lowerFrustum);
      // 下段の縦ネオンライン（稜線に沿った発光帯）
      group.add(makeVerticalNeon(DIM.LOWER));

      // =================================================================
      // (3) 中段 展望台リング（24〜27）— 少し張り出した発光帯
      //     四角枠の手すり＋帯（deck テクスチャ）。一辺13、厚1.5。
      // =================================================================
      (function buildMidDeck() {
        var d = DIM.MIDDECK;
        var deckMap = texTower('deck', isNight);

        // 3-a 床盤（薄い四角板）— 下段錐台より少し張り出す
        var slabMat = new THREE.MeshStandardMaterial({
          color: 0x7a4326, roughness: 0.7, metalness: 0.15, map: deckMap || null
        });
        var slabH = 0.8;
        var slab = new THREE.Mesh(new THREE.BoxGeometry(d.side, slabH, d.side), slabMat);
        slab.position.y = d.yBottom + slabH / 2;
        slab.castShadow = true;
        slab.receiveShadow = false;
        group.add(slab);

        // 3-b 発光する帯（展望台の光る手すり）— emissive 暖白
        var bandMat = makeEmissiveMaterial({
          color: 0x3a2412,
          emissive: 0xffd27a,
          map: deckMap || null
        });
        var bandH = d.thick;
        var ring = makeSquareRing(d.side, 0.9, bandH, d.yBottom + slabH + bandH / 2, bandMat);
        group.add(ring);
      })();

      // =================================================================
      // (4) 上段 四角錐台（27〜41）— さらに細く絞る
      // =================================================================
      var upperFrustum = makeSquareFrustum(DIM.UPPER, iron);
      group.add(upperFrustum);
      group.add(makeVerticalNeon(DIM.UPPER));

      // =================================================================
      // (5) 上段 展望台（41〜44）— 丸い展望台（円柱）＋発光帯
      // =================================================================
      (function buildUpperDeck() {
        var d = DIM.UPDECK;
        var deckMap = texTower('deck', isNight);

        // 5-a 円柱の床
        var bodyMat = new THREE.MeshStandardMaterial({
          color: 0x7a4326, roughness: 0.7, metalness: 0.15, map: deckMap || null
        });
        var body = new THREE.Mesh(
          new THREE.CylinderGeometry(d.R, d.R, d.h, 24, 1, false),
          bodyMat
        );
        body.position.y = d.yBottom + d.h / 2;
        body.castShadow = true;
        body.receiveShadow = false;
        group.add(body);

        // 5-b 発光リング（丸い帯）— トーラスで一周光らせる
        var ringMat = makeEmissiveMaterial({
          color: 0x3a2412,
          emissive: 0xfff0c0
        });
        var torus = new THREE.Mesh(
          new THREE.TorusGeometry(d.R + 0.15, 0.28, 10, 32),
          ringMat
        );
        torus.rotation.x = Math.PI / 2; // 水平に寝かせて手すりの光に
        torus.position.y = d.yBottom + d.h * 0.62;
        torus.castShadow = false;
        torus.receiveShadow = false;
        group.add(torus);
      })();

      // =================================================================
      // (6) 頂部 広告塔（44〜50）— 丸い円筒 ＋ 色相が回るネオンリング
      // =================================================================
      (function buildAdTower() {
        var d = DIM.ADTOWER;

        // 6-a 円筒の広告塔本体。側面は ad テクスチャ（発光面）。
        var adMap = texTower('ad', isNight);
        var adMat = makeEmissiveMaterial({
          color: 0x2a1c0a,
          emissive: 0xffc24a,
          emissiveMap: adMap || null,
          map: adMap || null
        });
        var ad = new THREE.Mesh(
          new THREE.CylinderGeometry(d.R, d.R, d.h, 24, 1, false),
          adMat
        );
        ad.position.y = d.yBottom + d.h / 2;
        ad.castShadow = true;
        ad.receiveShadow = false;
        group.add(ad);

        // 6-b 上下のフチ（金属リング）
        var rimMat = new THREE.MeshStandardMaterial({
          color: 0x9a4a2a, roughness: 0.6, metalness: 0.3
        });
        var rimGeo = new THREE.TorusGeometry(d.R + 0.05, 0.18, 8, 28);
        var rimTop = new THREE.Mesh(rimGeo, rimMat);
        rimTop.rotation.x = Math.PI / 2;
        rimTop.position.y = d.yTop - 0.3;
        var rimBot = new THREE.Mesh(rimGeo, rimMat);
        rimBot.rotation.x = Math.PI / 2;
        rimBot.position.y = d.yBottom + 0.3;
        rimTop.castShadow = rimBot.castShadow = false;
        group.add(rimTop);
        group.add(rimBot);

        // 6-c 色相が回るネオンリング（複数段）。ring テクスチャ＋発光。hueRing 登録。
        var ringMap = texTower('ring', isNight);
        var ringYs = [d.yBottom + 1.2, d.yBottom + d.h * 0.5, d.yTop - 1.0];
        for (var i = 0; i < ringYs.length; i++) {
          var hueMat = makeEmissiveMaterial({
            color: 0x100810,
            emissive: 0xff2d6f, // 初期はピンク。onUpdate で hue が回る。
            map: ringMap || null,
            emissiveMap: ringMap || null,
            hueRing: true
          });
          var ring = new THREE.Mesh(
            new THREE.TorusGeometry(d.R + 0.35, 0.22, 10, 40),
            hueMat
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = ringYs[i];
          ring.castShadow = false;
          ring.receiveShadow = false;
          group.add(ring);
        }
      })();

      // =================================================================
      // (7) アンテナ（50〜56）— 細い円柱 ＋ 先端の発光球
      // =================================================================
      (function buildAntenna() {
        var d = DIM.ANTENNA;
        var poleMat = new THREE.MeshStandardMaterial({
          color: 0xb0b4b8, roughness: 0.5, metalness: 0.4
        });
        var pole = new THREE.Mesh(
          new THREE.CylinderGeometry(d.R, d.R * 1.6, d.h, 12, 1, false),
          poleMat
        );
        pole.position.y = d.yBottom + d.h / 2;
        pole.castShadow = true;
        pole.receiveShadow = false;
        group.add(pole);

        // 先端の航空障害灯っぽい発光玉（赤く点く）。emissive 登録（夜だけ強く）。
        var tipMat = makeEmissiveMaterial({
          color: 0x551111,
          emissive: 0xff3322
        });
        var tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), tipMat);
        tip.position.y = d.yTop + 0.2;
        tip.castShadow = false;
        tip.receiveShadow = false;
        group.add(tip);
      })();

      // =================================================================
      // 配置・影・登録
      // =================================================================
      // 足元中心を TOWER_POS(0,0,28) に置く。
      var pos = City.TOWER_POS || { x: 0, y: 0, z: 28 };
      group.position.set(pos.x, pos.y, pos.z);

      // 鉄塔本体は影を落とす（receiveShadow は false 指定済み）。
      group.castShadow = true;
      group.receiveShadow = false;

      // ---- 情報（§12.1）と夜更新フックを userData に設定 ----
      group.userData.info = INFO;
      group.userData.name = INFO.name; // クリック情報用の素朴な name も付与
      // setNight 時に呼ばれる：この通天閣の発光マテリアルを一括で切替える。
      group.userData.onNight = function (flag) {
        var inten = flag ? EMI_NIGHT : EMI_DAY;
        for (var i = 0; i < _emissiveMats.length; i++) {
          _emissiveMats[i].emissiveIntensity = inten;
          _emissiveMats[i].needsUpdate = true;
        }
        // 代表 PointLight も夜のみ意味があるので強度を切替（City 側でも管理されるが二重で安全に）。
        for (var j = 0; j < decoLights.length; j++) {
          if (decoLights[j]) {
            decoLights[j].intensity = flag ? decoLights[j].userData._baseIntensity : 0.0;
          }
        }
      };

      // ---- City へ登録（情報を持つ親）＋ シーンに追加 ----
      City.register(group);
      City.scene.add(group);

      // =================================================================
      // 代表 PointLight（夜のライトアップ）: 頂部(0,52,28) と 中段(0,30,28)
      //   City.addDecoLight 経由（予算24灯・castShadow=false）。暖色。
      //   ※ world 座標で指定する契約なので group ではなく City.addDecoLight に絶対座標で渡す。
      // =================================================================
      (function addTowerLights() {
        if (typeof City.addDecoLight !== 'function') return;
        var lights = [
          { color: 0xffe0b0, intensity: 1.3, distance: 80, pos: { x: 0, y: 52, z: 28 } }, // 頂部
          { color: 0xffd2a0, intensity: 1.1, distance: 70, pos: { x: 0, y: 30, z: 28 } }  // 中段
        ];
        for (var i = 0; i < lights.length; i++) {
          var L = lights[i];
          var pl = City.addDecoLight(L.color, L.intensity, L.distance, L.pos);
          if (pl) {
            // 夜昼切替で元の強度に戻せるよう基準値を覚えておく。
            pl.userData._baseIntensity = L.intensity;
            // 起動時が昼なら消しておく（City 側の管理に任せても良いが整合のため）。
            if (!isNight) pl.intensity = 0.0;
            decoLights.push(pl); // ← onNight が参照する同一配列に詰める
          }
        }
      })();
      // 参照しやすいよう userData にも保持（外部デバッグ用・任意）。
      group.userData._decoLights = decoLights;

      // =================================================================
      // 毎フレーム更新：頂部ネオンリングの色相を回す（City.onUpdate に1回だけ登録）。
      // =================================================================
      if (!_updaterBound && typeof City.onUpdate === 'function') {
        _updaterBound = true;
        var _col = new THREE.Color();
        City.onUpdate(function (dt, t) {
          // 夜のみ色相を回す（昼はほぼ消えているので計算しても見えない＝軽く回し続けてOK）。
          // hue は 0〜1 を周期 ~6 秒で循環。リングごとに少し位相をずらして虹が流れる感じに。
          for (var i = 0; i < _hueRingMats.length; i++) {
            var hue = ((t * 0.16) + i * 0.18) % 1.0;
            _col.setHSL(hue, 0.95, 0.55);
            _hueRingMats[i].emissive.copy(_col);
          }
        });
      }

      return group;
    }
  };

})();

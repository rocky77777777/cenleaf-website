/* =============================================================================
 *  scene.js  —  window.City（ミニチュア新世界・コア）
 * -----------------------------------------------------------------------------
 *  Three.js r137 / グローバル THREE / THREE.OrbitControls 前提。
 *  import/export/require/fetch 禁止。すべて window.City で公開する。
 *
 *  役割（DESIGN.md §1, §3）:
 *   - WebGLRenderer / Scene / PerspectiveCamera / OrbitControls / Clock の構築
 *   - 夜（デフォルト）/昼 の2系統ライティング切替（setNight）
 *   - 地面・通り床・区画タイル（Tex.road）の生成
 *   - register()：情報を持つオブジェクト登録（クリック/フォーカス対象）
 *   - onUpdate()/update()/start()：rAF ループは City が1本だけ持つ
 *   - focusOn()/reset()：カメラと controls.target を滑らかに補間（内部トゥイーン）
 *   - addDecoLight()：装飾 PointLight を予算（24灯）内で追加
 *
 *  ※ ライブラリ（three / OrbitControls）→ scene.js → textures.js … の順で
 *    読み込まれる。City.init() は window.onload 内で呼ばれるため、その時点では
 *    window.Tex は既に定義済み。ただし安全のため Tex 不在時のフォールバックを持つ。
 * ========================================================================== */

window.City = {

  // ===== three.js コアオブジェクト（init後に有効）=========================
  scene:    null,   // THREE.Scene
  camera:   null,   // THREE.PerspectiveCamera
  renderer: null,   // THREE.WebGLRenderer
  controls: null,   // THREE.OrbitControls
  clock:    null,   // THREE.Clock

  // ===== 登録物・状態 =====================================================
  objects:  [],     // register() された“情報を持つ”オブジェクト群（Raycast対象の親）
  updaters: [],     // onUpdate() で登録された毎フレームコールバック
  night:    true,   // 現在 夜か（true=夜, false=昼）。デフォルト 夜景

  // ===== 公開定数（レイアウト・カメラ）=== ※ DESIGN.md §2 と一致 =========
  GROUND_SIZE:    200,
  STREET_WIDTH:   18,
  STREET_Z_MIN:  -76,                       // アーケード南端の z
  STREET_Z_MAX:    6,                       // アーケード北端の z
  TOWER_POS:      { x: 0, y: 0, z: 28 },    // 通天閣の足元中心
  CAMERA_HOME:    { x: 70, y: 78, z: -118 },
  TARGET_HOME:    { x: 0,  y: 12, z: -18  },
  MAX_POINTLIGHTS: 24,
  SHADOWS:        true,                      // false で全影 off（重い環境用）

  MIN_FOCUS_DIST: 24,                        // focusOn の最小寄り距離

  // ===== 内部状態（外部から触らない）=====================================
  _running: false,                           // start() 多重起動防止
  _t: 0,                                      // 起動からの累積秒
  _decoLights: [],                            // addDecoLight で追加した装飾 PointLight
  _nightLights: [],                           // 夜専用ライト（Ambient/Hemi/Search 等）
  _dayLights: [],                             // 昼専用ライト（Directional/Ambient/Hemi）
  _groundGroup: null,                         // 地面・通り床のまとめ Group
  _groundMat: null,                           // 地面ベースのマテリアル（昼夜で色替え）
  _skyNight: null,                            // 夜空 CanvasTexture（init で1枚だけ生成・使い回し）
  _skyDay: null,                              // 昼空 CanvasTexture（init で1枚だけ生成・使い回し）
  _searchLight: null,                         // 夜の主光源（通天閣サーチライト・影主）
  _searchTarget: null,                        // サーチライトの注視ターゲット
  _tween: {                                   // focusOn / reset のトゥイーン状態
    active: false,
    fromPos: null, toPos: null,
    fromTgt: null, toTgt: null,
    t: 0, dur: 0.8,
  },

  /* ===========================================================================
   *  init() — DESIGN.md §1.1（順序固定）
   * ======================================================================== */
  init: function () {
    var W = window.innerWidth, H = window.innerHeight;

    // 1) Scene / Renderer ----------------------------------------------------
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // ≤2
    this.renderer.setSize(W, H);
    // r137 世代の color/lights API（取り違え禁止）
    this.renderer.outputEncoding       = THREE.sRGBEncoding;
    this.renderer.toneMapping          = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure  = 1.0;
    this.renderer.shadowMap.enabled    = this.SHADOWS;
    this.renderer.shadowMap.type       = THREE.PCFSoftShadowMap;

    // 2) canvas を #app に append（無ければ body）----------------------------
    var host = document.getElementById('app') || document.body;
    host.appendChild(this.renderer.domElement);

    // 3) Camera --------------------------------------------------------------
    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 2000);
    this.camera.position.set(this.CAMERA_HOME.x, this.CAMERA_HOME.y, this.CAMERA_HOME.z);

    // 4) OrbitControls -------------------------------------------------------
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping       = true;
    this.controls.dampingFactor       = 0.08;
    this.controls.minDistance         = 2;      // 地面レベルまでグッと寄れる
    this.controls.maxDistance         = 320;
    this.controls.maxPolarAngle       = 2.0;    // ≈115° 水平を越えて上を見上げられる（通天閣やアーケードの天井を下から見上げる）
    this.controls.minPolarAngle       = 0.15;
    this.controls.enablePan           = true;
    this.controls.screenSpacePanning  = true;   // パンで視点を上下にも動かせる（歩行者目線へ降りやすく）
    this.controls.target.set(this.TARGET_HOME.x, this.TARGET_HOME.y, this.TARGET_HOME.z);
    this.controls.update();

    // 5) 地面・道路・区画 -----------------------------------------------------
    this._buildGround();
    this.scene.add(this._groundGroup);

    // 5.5) 空テクスチャを昼夜1枚ずつ生成してキャッシュ（DESIGN.md §3.2/§3.3）
    //   昼夜トグルを連打しても sky を再生成しない＝GPUテクスチャの累積リーク防止。
    //   Tex 未ロード/例外時は null のまま（_applyEnvironment が単色フォールバック）。
    this._skyNight = this._safeTex(function (Tex) { return Tex.sky(true); });
    this._skyDay   = this._safeTex(function (Tex) { return Tex.sky(false); });

    // 6) 夜ライティング構築（night=true の状態へ）-----------------------------
    this._buildLights();
    this._setLightMode(true);                  // 既定は夜

    // 空・フォグも夜に揃える（_applyEnvironment は this.night を見る）
    this.night = true;
    this._applyEnvironment(true);

    // 7) Clock / リサイズリスナ（ループは start() まで回さない）---------------
    this.clock = new THREE.Clock();
    var self = this;
    window.addEventListener('resize', function () { self._onResize(); });

    // ページ離脱時にGPUリソースを明示解放（リーク・再ロード対策）。
    // 単回ロードの静的ページなのでブラウザ任せでも問題はないが、
    // 将来 build を作り直す設計に変えたときの孤児リソース化を防ぐ保険。
    window.addEventListener('beforeunload', function () { self.disposeAll(); });
  },

  /* ===========================================================================
   *  register(obj) — 情報を持つオブジェクトを登録（DESIGN.md §1.3）
   *   - this.objects に push
   *   - obj とその全子孫の userData.cityRoot = obj（Raycast→情報親 解決用）
   *   - scene への add は呼び出し側の責務（ここでは情報登録のみ）
   * ======================================================================== */
  register: function (obj) {
    if (!obj) return obj;
    this.objects.push(obj);
    // obj 自身を含む全ノードに cityRoot を貼る
    obj.traverse(function (node) {
      node.userData.cityRoot = obj;
    });
    return obj; // チェーン用にそのまま返す
  },

  /* ===========================================================================
   *  onUpdate(fn) — 毎フレーム呼ばれるコールバックを登録（DESIGN.md §1.4）
   *   fn(dt, t): dt=前フレームからの秒, t=起動からの累積秒
   * ======================================================================== */
  onUpdate: function (fn) {
    if (typeof fn === 'function') this.updaters.push(fn);
  },

  /* ===========================================================================
   *  update(dt) — 1フレーム進める（DESIGN.md §1.2）
   *   controls.update() → updaters 実行 → トゥイーン進行 → render
   *   updaters の1つの例外で全体が止まらないよう try/catch する。
   * ======================================================================== */
  update: function (dt) {
    // damping を効かせるため毎フレーム controls.update
    if (this.controls) this.controls.update();

    // 累積時間
    this._t = (this._t || 0) + dt;

    // 登録 updater（ネオン点滅・提灯ゆれ・通天閣リング 等）
    var us = this.updaters;
    for (var i = 0; i < us.length; i++) {
      try {
        us[i](dt, this._t);
      } catch (e) {
        // 1つの updater の例外でループ全体を止めない
        if (window.console && console.error) {
          console.error('[City] updater error:', e);
        }
      }
    }

    // focus / reset のトゥイーン進行
    this._stepTween(dt);

    // 描画
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  },

  /* ===========================================================================
   *  start() — rAF ループ開始（DESIGN.md §1.2）。多重起動防止。
   * ======================================================================== */
  start: function () {
    if (this._running) return;
    this._running = true;
    var self = this;
    var loop = function () {
      requestAnimationFrame(loop);
      var dt = self.clock ? self.clock.getDelta() : 0;
      self.update(dt);
    };
    loop();
  },

  /* ===========================================================================
   *  focusOn(target) — 対象へカメラ/controls.target を補間（DESIGN.md §1.6）
   *   target: THREE.Object3D | THREE.Vector3 | {x,y,z}
   *   - 中心 C と半径 r（Object3D は Box3 球半径、Vector3/obj は r=12）
   *   - dist = max(MIN_FOCUS_DIST, r*2.4)
   *   - toPos = C + 正規化(0.55,0.6,-0.58) * dist（南西やや上）
   *   - toTgt = C（ただし y は max(C.y, 6)）
   * ======================================================================== */
  focusOn: function (target) {
    if (!target || !this.camera || !this.controls) return;

    var C = new THREE.Vector3();   // 対象中心
    var r = 12;                    // 半径（既定）

    if (target.isObject3D) {
      // ワールド中心と境界球半径を Box3 から算出
      var box = new THREE.Box3().setFromObject(target);
      if (box.isEmpty()) {
        target.getWorldPosition(C);
      } else {
        box.getCenter(C);
        var sph = new THREE.Sphere();
        box.getBoundingSphere(sph);
        r = sph.radius || 12;
      }
    } else if (target.isVector3) {
      C.set(target.x, target.y, target.z);
      r = 12;
    } else {
      // {x,y,z} プレーンオブジェクト
      C.set(target.x || 0, target.y || 0, target.z || 0);
      r = 12;
    }

    var dist = Math.max(this.MIN_FOCUS_DIST, r * 2.4);

    // 南西やや上から見上げる方向（街並みと整合）
    var dir = new THREE.Vector3(0.55, 0.6, -0.58).normalize();
    var toPos = C.clone().add(dir.multiplyScalar(dist));

    var toTgt = C.clone();
    toTgt.y = Math.max(C.y, 6);

    this._beginTween(toPos, toTgt);
  },

  /* ===========================================================================
   *  reset() — CAMERA_HOME / TARGET_HOME へ補間（DESIGN.md §1）
   * ======================================================================== */
  reset: function () {
    if (!this.camera || !this.controls) return;
    var toPos = new THREE.Vector3(this.CAMERA_HOME.x, this.CAMERA_HOME.y, this.CAMERA_HOME.z);
    var toTgt = new THREE.Vector3(this.TARGET_HOME.x, this.TARGET_HOME.y, this.TARGET_HOME.z);
    this._beginTween(toPos, toTgt);
  },

  /* ===========================================================================
   *  walkView() — 歩行者目線：ジャンジャン横丁の通りに降りて通天閣方向を見通す
   * ======================================================================== */
  walkView: function () {
    if (!this.camera || !this.controls) return;
    // 通りの南端(Z=-72)・目線高さ2.5m（地面レベルの歩行者）から、北の通天閣方向(Z=+12)をほぼ水平に見通す
    var toPos = new THREE.Vector3(0, 2.5, -72);
    var toTgt = new THREE.Vector3(0, 3, 12);
    this._beginTween(toPos, toTgt);
  },

  /* ===========================================================================
   *  lookUp() — 地面レベルから頭上（アーケードの看板〜通天閣方向）を見上げる
   * ======================================================================== */
  lookUp: function () {
    if (!this.camera || !this.controls) return;
    // 通りの中・目線高さ2.5m（地面レベル）を保ったまま、前方上を見上げる
    var toPos = new THREE.Vector3(0, 2.5, -30);
    var toTgt = new THREE.Vector3(0, 17, 16);
    this._beginTween(toPos, toTgt);
  },

  /* ===========================================================================
   *  setNight(flag) — 夜/昼の切替（DESIGN.md §1 setNight, §3）
   *   - this.night = !!flag
   *   - background / fog を §3 の値に
   *   - 夜昼ライト群を on/off（装飾 PointLight は夜のみ点灯）
   *   - 最後に _applyNightToRegistered() で各 obj.userData.onNight(flag) を実行
   * ======================================================================== */
  setNight: function (flag) {
    this.night = !!flag;
    this._setLightMode(this.night);            // ライト群 on/off
    this._applyEnvironment(this.night);        // 空色・fog・地面色
    this._applyNightToRegistered(this.night);  // 各モジュールの発光切替フック
  },

  /* ===========================================================================
   *  addDecoLight(color, intensity, distance, pos) — 予算内で装飾 PointLight 追加
   *   （DESIGN.md §1, §3.2）。MAX_POINTLIGHTS 超過は null を返し追加しない。
   *   castShadow=false 固定。夜のみ表示（_setLightMode で visible を切替）。
   * ======================================================================== */
  addDecoLight: function (color, intensity, distance, pos) {
    if (this._decoLights.length >= this.MAX_POINTLIGHTS) {
      return null; // 予算超過。見た目は emissive で担保
    }
    var light = new THREE.PointLight(color, intensity, distance);
    light.castShadow = false; // 装飾は影なし（負荷対策）
    if (pos) light.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
    // 現在の昼夜に合わせて可視を設定（夜=点灯, 昼=弱め）
    light.visible = this.night;
    this.scene.add(light);
    this._decoLights.push(light);
    return light;
  },

  /* ===========================================================================
   *  以降は内部ヘルパ（_ 始まり）。外部からは基本呼ばない。
   * ======================================================================== */

  /* ---- 地面・通り床・区画（DESIGN.md §3.4）-------------------------------- */
  _buildGround: function () {
    var g = new THREE.Group();
    g.name = 'groundGroup';

    // 地面ベース 200×200（夜 #15171c / 昼 #3a3d44）
    var baseGeo = new THREE.PlaneGeometry(this.GROUND_SIZE, this.GROUND_SIZE);
    baseGeo.rotateX(-Math.PI / 2); // XZ 平面へ
    this._groundMat = new THREE.MeshStandardMaterial({
      color: 0x15171c,            // 既定は夜色
      roughness: 0.95,
      metalness: 0.0,
    });
    var base = new THREE.Mesh(baseGeo, this._groundMat);
    base.position.y = 0;
    base.receiveShadow = true;
    base.name = 'ground-base';
    g.add(base);

    // 通り床 18×84（z中心 -35）。Tex.road を貼る。y=0.02 で z-fighting 回避
    var roadGeo = new THREE.PlaneGeometry(this.STREET_WIDTH, 84);
    roadGeo.rotateX(-Math.PI / 2);
    var roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.0,
    });
    var roadTex = this._safeTex(function (Tex) { return Tex.road({ night: true }); });
    if (roadTex) {
      roadMat.map = roadTex;
      roadMat.color.set(0xffffff); // テクスチャをそのまま出す
    } else {
      roadMat.color.set(0x202329); // フォールバックのアスファルト色
    }
    var road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(0, 0.02, -35);
    road.receiveShadow = true;
    road.name = 'street-floor';
    g.add(road);

    this._groundGroup = g;
  },

  /* ---- 夜昼ライト群の構築（DESIGN.md §3.2 / §3.3）------------------------- */
  _buildLights: function () {
    // ---------- 夜（night=true）----------
    // 夜の弱い環境光（青め）
    var nAmb = new THREE.AmbientLight(0x223044, 0.35);
    // 空↔地の弱いグラデ環境光
    var nHemi = new THREE.HemisphereLight(0x202840, 0x05060a, 0.25);

    // 通天閣サーチライト（影の主光源）
    var search = new THREE.DirectionalLight(0xfff0d0, 0.5);
    search.position.set(40, 120, 60);
    // target を通天閣（TOWER_POS）に向ける
    var sTarget = new THREE.Object3D();
    sTarget.position.set(this.TOWER_POS.x, this.TOWER_POS.y, this.TOWER_POS.z);
    this.scene.add(sTarget);
    search.target = sTarget;
    this._searchTarget = sTarget;
    this._searchLight  = search;
    this._configureShadow(search);

    this._nightLights = [nAmb, nHemi, search];

    // ---------- 昼（night=false）----------
    var dDir = new THREE.DirectionalLight(0xfff5e8, 1.1);
    dDir.position.set(60, 130, 40);
    // 昼の主光源も街中心を狙う（影カメラ共有のため target を原点付近に）
    var dTarget = new THREE.Object3D();
    dTarget.position.set(0, 0, -20);
    this.scene.add(dTarget);
    dDir.target = dTarget;
    this._configureShadow(dDir);

    var dAmb  = new THREE.AmbientLight(0xb8c6d6, 0.7);
    var dHemi = new THREE.HemisphereLight(0xcfe0ee, 0x6b6f63, 0.6);

    this._dayLights = [dDir, dAmb, dHemi];

    // すべて scene に add しておき、可視は _setLightMode で切替える
    var all = this._nightLights.concat(this._dayLights);
    for (var i = 0; i < all.length; i++) this.scene.add(all[i]);
  },

  /* ---- 主光源の shadow.camera を街全体に合わせる（DESIGN.md §3.2）-------- */
  _configureShadow: function (dirLight) {
    dirLight.castShadow = this.SHADOWS;
    var cam = dirLight.shadow.camera;
    cam.left = -120; cam.right = 120;
    cam.top  = 120;  cam.bottom = -120;
    cam.near = 1;    cam.far = 400;
    cam.updateProjectionMatrix();
    dirLight.shadow.mapSize.set(2048, 2048);
    // ピーターパン回避の軽いバイアス
    dirLight.shadow.bias = -0.0005;
  },

  /* ---- 夜/昼でライト群と装飾灯の可視を切替（DESIGN.md §3.2/§3.3）-------- */
  _setLightMode: function (isNight) {
    var i;
    // 夜ライト
    for (i = 0; i < this._nightLights.length; i++) {
      this._nightLights[i].visible = isNight;
    }
    // 昼ライト
    for (i = 0; i < this._dayLights.length; i++) {
      this._dayLights[i].visible = !isNight;
    }
    // 影を落とす主光源は「現在モードの DirectionalLight」だけ castShadow
    if (this._searchLight) this._searchLight.castShadow = this.SHADOWS && isNight;
    if (this._dayLights[0]) this._dayLights[0].castShadow = this.SHADOWS && !isNight;

    // 装飾 PointLight：夜は点灯、昼は intensity を絞る（DESIGN.md §3.3）
    for (i = 0; i < this._decoLights.length; i++) {
      var dl = this._decoLights[i];
      if (isNight) {
        // 夜：元の強さに戻す（初回値を保持）
        if (dl.userData._baseInt === undefined) dl.userData._baseInt = dl.intensity;
        dl.intensity = dl.userData._baseInt;
        dl.visible = true;
      } else {
        // 昼：提灯・ネオンは光って見えない方が自然 → 大幅に弱める
        if (dl.userData._baseInt === undefined) dl.userData._baseInt = dl.intensity;
        dl.intensity = dl.userData._baseInt * 0.12; // 0〜0.2 相当に圧縮
        dl.visible = false; // 実質オフ（見た目は emissive 側で下げる）
      }
    }
  },

  /* ---- 空（background）・フォグ・地面色を昼夜で適用（DESIGN.md §3）-------
   *  空テクスチャは init でキャッシュした _skyNight / _skyDay を使い回す。
   *  setNight を連打しても新規 CanvasTexture を作らない＝GPUメモリの累積リーク防止。
   *  もし直前の background がキャッシュ外の使い捨て CanvasTexture（万一の経路）なら、
   *  差し替え前に dispose して孤児テクスチャを残さない（安全網）。
   *  fog（THREE.Fog）は軽量なので毎回 new で問題なし。 */
  _applyEnvironment: function (isNight) {
    var nextBg, fog, groundColor;
    if (isNight) {
      // 夜空：キャッシュ済み _skyNight。無ければ濃紺の単色フォールバック
      nextBg = this._skyNight || new THREE.Color(0x0a0e1a);
      fog = new THREE.Fog(0x0a0e1a, 120, 420);
      groundColor = 0x15171c;
    } else {
      // 昼空：キャッシュ済み _skyDay。無ければ水色の単色フォールバック
      nextBg = this._skyDay || new THREE.Color(0xbcd3e8);
      fog = new THREE.Fog(0xcfe0ee, 200, 600);
      groundColor = 0x3a3d44;
    }

    // 差し替え前の安全網：現在の background がキャッシュ2枚（使い回し）以外の
    // CanvasTexture/Texture なら dispose（通常は発生しないが孤児リソース防止）。
    var prev = this.scene.background;
    if (prev && prev.isTexture &&
        prev !== this._skyNight && prev !== this._skyDay &&
        prev !== nextBg) {
      prev.dispose();
    }

    this.scene.background = nextBg;
    this.scene.fog = fog;
    if (this._groundMat) this._groundMat.color.set(groundColor);
  },

  /* ---- 登録オブジェクトへ夜更新フックを伝播（DESIGN.md §1, §13-2）------- */
  _applyNightToRegistered: function (isNight) {
    for (var i = 0; i < this.objects.length; i++) {
      var o = this.objects[i];
      var hook = o && o.userData ? o.userData.onNight : null;
      if (typeof hook === 'function') {
        try {
          hook(isNight);
        } catch (e) {
          if (window.console && console.error) {
            console.error('[City] onNight hook error:', e);
          }
        }
      }
    }
  },

  /* ---- トゥイーン開始（focusOn / reset 共通）----------------------------- */
  _beginTween: function (toPos, toTgt) {
    var tw = this._tween;
    tw.fromPos = this.camera.position.clone();
    tw.toPos   = toPos.clone();
    tw.fromTgt = this.controls.target.clone();
    tw.toTgt   = toTgt.clone();
    tw.t       = 0;
    tw.dur     = 0.8;
    tw.active  = true;
  },

  /* ---- トゥイーン進行（DESIGN.md §1.6, update から毎フレーム）----------- */
  _stepTween: function (dt) {
    var tw = this._tween;
    if (!tw.active) return;
    tw.t += dt;
    var x = tw.t / tw.dur;
    if (x > 1) x = 1;
    var k = 1 - Math.pow(1 - x, 3); // easeOutCubic
    this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
    this.controls.target.lerpVectors(tw.fromTgt, tw.toTgt, k);
    if (tw.t >= tw.dur) tw.active = false;
  },

  /* ---- リサイズ対応（DESIGN.md §1.5）------------------------------------ */
  _onResize: function () {
    var W = window.innerWidth, H = window.innerHeight;
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
  },

  /* ---- Tex 安全呼び出し（textures.js 未ロード/例外でも落ちない）--------- */
  _safeTex: function (fn) {
    try {
      if (window.Tex && typeof fn === 'function') {
        var t = fn(window.Tex);
        return t || null;
      }
    } catch (e) {
      if (window.console && console.warn) {
        console.warn('[City] Tex fallback:', e);
      }
    }
    return null;
  },

  /* ===========================================================================
   *  disposeAll() — GPUリソースの一括解放（DESIGN.md外の保険・リーク対策）
   * ---------------------------------------------------------------------------
   *  目的（品質チェック issue#3 推奨(2)）:
   *   - シーングラフを traverse して geometry / material / material の各 map を dispose。
   *   - キャッシュした空テクスチャ（_skyNight/_skyDay）と現在の background を dispose。
   *   - WebGLRenderer 自体も dispose（コンテキスト/プログラムを解放）。
   *  単回ロードの静的ページではブラウザ任せでも害は無いが、ページ離脱(beforeunload)や
   *  将来 build を作り直す設計に変えた際の「孤児リソース化」を防ぐ。多重呼び出し安全。
   *  ※ init() の beforeunload リスナがこれを呼ぶ。未定義だと unload 時に例外になるため必須。
   * ======================================================================== */
  disposeAll: function () {
    // ループ停止（以降 render しない）
    this._running = false;

    var disposed = []; // material 二重 dispose 防止用（同一 material の共有が多い）

    function disposeMaterial(mat) {
      if (!mat) return;
      // material が配列（multi-material）の場合も処理
      if (Array.isArray(mat)) {
        for (var m = 0; m < mat.length; m++) disposeMaterial(mat[m]);
        return;
      }
      if (disposed.indexOf(mat) !== -1) return;
      disposed.push(mat);
      // material が持つ各種テクスチャ slot を dispose
      var slots = ['map', 'emissiveMap', 'normalMap', 'roughnessMap',
                   'metalnessMap', 'aoMap', 'alphaMap', 'bumpMap',
                   'displacementMap', 'lightMap', 'envMap'];
      for (var s = 0; s < slots.length; s++) {
        var t = mat[slots[s]];
        if (t && t.isTexture && typeof t.dispose === 'function') t.dispose();
      }
      if (typeof mat.dispose === 'function') mat.dispose();
    }

    // 1) シーングラフ全走査（geometry / material / map）
    if (this.scene && typeof this.scene.traverse === 'function') {
      this.scene.traverse(function (node) {
        if (node.geometry && typeof node.geometry.dispose === 'function') {
          node.geometry.dispose();
        }
        if (node.material) disposeMaterial(node.material);
      });
    }

    // 2) 背景・キャッシュ空テクスチャ（CanvasTexture）を dispose
    if (this.scene && this.scene.background &&
        this.scene.background.isTexture &&
        typeof this.scene.background.dispose === 'function') {
      this.scene.background.dispose();
    }
    if (this._skyNight && this._skyNight.isTexture) this._skyNight.dispose();
    if (this._skyDay && this._skyDay.isTexture) this._skyDay.dispose();
    this._skyNight = null;
    this._skyDay = null;
    if (this.scene) {
      this.scene.background = null;
      this.scene.fog = null;
    }

    // 3) 主光源の shadow map を解放（装飾 PointLight は castShadow=false なので対象外）
    if (this._searchLight && this._searchLight.shadow &&
        this._searchLight.shadow.map && this._searchLight.shadow.map.dispose) {
      this._searchLight.shadow.map.dispose();
    }
    if (this._dayLights && this._dayLights[0] && this._dayLights[0].shadow &&
        this._dayLights[0].shadow.map && this._dayLights[0].shadow.map.dispose) {
      this._dayLights[0].shadow.map.dispose();
    }

    // 4) Renderer 本体を解放（WebGL コンテキスト・プログラムキャッシュ）
    if (this.renderer && typeof this.renderer.dispose === 'function') {
      this.renderer.dispose();
    }
  },
};

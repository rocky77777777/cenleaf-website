/* =====================================================================
 * explore.js → window.Explore
 * ---------------------------------------------------------------------
 * 三人称（ポケモンSV風）の散策モード。
 *  - 西成のオジサンのキャラを通りに出し、WASD/矢印キーで歩かせる
 *  - カメラはキャラの斜め後ろから追従、移動方向にキャラが向く
 *  - 歩ける範囲はジャンジャン横丁の通り（建物に入らない＝範囲クランプ）
 *  - scene.js は変更せず City.onUpdate(fn) に歩行更新を差し込む
 *
 * 依存: Three.js r137 / window.City（scene.js）。file://制約: 外部資産なし。
 * 公開: window.Explore = { init, enter, exit, active }
 * ===================================================================== */
(function () {
  'use strict';

  var T = THREE;

  var Explore = {
    active: false,
    player: null,
    _legL: null, _legR: null, _armL: null, _armR: null,
    _keys: { up: false, down: false, left: false, right: false, run: false },
    _yaw: 0,          // キャラの向き（ラジアン, +Z=0）
    _walkPhase: 0,
    _bound: false,

    // 歩行可能範囲（DESIGN layout: 通り幅 X:-9〜9 / アーケード Z:-76〜6 / 通天閣 Z=28）
    BOUNDS: { xMin: -7.5, xMax: 7.5, zMin: -74, zMax: 25 },
    SPEED_WALK: 13,   // units/秒
    SPEED_RUN: 24,
    CAM_DIST: 14,     // キャラ後方へのカメラ距離
    CAM_HEIGHT: 13,   // カメラ高さ（アーケードの看板・吊り看板を越えて見下ろす）

    /* ---- 初期化：キャラ生成・キー登録・毎フレーム更新の差し込み ---- */
    init: function () {
      if (this._bound) return;
      this._bound = true;
      this._buildPlayer();
      this._bindKeys();
      var self = this;
      if (window.City && typeof City.onUpdate === 'function') {
        City.onUpdate(function (dt) { self._tick(dt); });
      }
    },

    /* ---- オジサンの低ポリキャラ（高さ≒4、足元が y=0）---- */
    _buildPlayer: function () {
      var g = new T.Group();

      function box(w, h, d, color) {
        return new T.Mesh(
          new T.BoxGeometry(w, h, d),
          new T.MeshStandardMaterial({ color: color, roughness: 0.85, metalness: 0.0 })
        );
      }
      function sphere(r, color) {
        return new T.Mesh(
          new T.SphereGeometry(r, 16, 12),
          new T.MeshStandardMaterial({ color: color, roughness: 0.8 })
        );
      }

      // 脚（ズボン紺）— 歩行アニメで前後に振る。原点を股関節に置くため Group 化
      var legL = new T.Group(); var legLmesh = box(0.5, 1.5, 0.5, 0x2a3a5a);
      legLmesh.position.y = -0.75; legL.add(legLmesh);
      var sandalL = box(0.6, 0.25, 0.85, 0x6b4a2a); sandalL.position.set(0, -1.55, 0.12); legL.add(sandalL);
      legL.position.set(-0.42, 1.5, 0);
      var legR = new T.Group(); var legRmesh = box(0.5, 1.5, 0.5, 0x2a3a5a);
      legRmesh.position.y = -0.75; legR.add(legRmesh);
      var sandalR = box(0.6, 0.25, 0.85, 0x6b4a2a); sandalR.position.set(0, -1.55, 0.12); legR.add(sandalR);
      legR.position.set(0.42, 1.5, 0);

      // 胴（白ランニング）＋腹巻き（暖色）
      var torso = box(1.5, 1.5, 0.9, 0xeeece4); torso.position.y = 2.55;
      var hara = box(1.62, 0.7, 1.0, 0xc97b3a); hara.position.y = 1.95; // 腹巻き

      // 腕（肌色）— 歩行で前後に振る
      var armL = new T.Group(); var armLmesh = box(0.4, 1.3, 0.4, 0xe8b48c);
      armLmesh.position.y = -0.6; armL.add(armLmesh);
      armL.position.set(-0.98, 3.0, 0);
      var armR = new T.Group(); var armRmesh = box(0.4, 1.3, 0.4, 0xe8b48c);
      armRmesh.position.y = -0.6; armR.add(armRmesh);
      armR.position.set(0.98, 3.0, 0);

      // 首タオル（白）
      var towel = box(1.1, 0.35, 1.0, 0xf2f2f2); towel.position.y = 3.35;

      // 頭（肌色）＋ 無精ひげっぽい影＋ニカッと
      var head = sphere(0.72, 0xe8b48c); head.position.y = 4.05;
      var nose = sphere(0.16, 0xd99a72); nose.position.set(0, 3.98, 0.66);
      // 薄毛：後頭部に少しだけ黒
      var hair = new T.Mesh(
        new T.SphereGeometry(0.74, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new T.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
      );
      hair.position.y = 4.05; hair.rotation.x = -0.5;

      g.add(legL, legR, torso, hara, armL, armR, towel, head, nose, hair);
      g.visible = false;
      g.position.y = 0;

      this.player = g;
      this._legL = legL; this._legR = legR;
      this._armL = armL; this._armR = armR;

      if (window.City && City.scene) City.scene.add(g);
    },

    /* ---- キーボード（WASD / 矢印 / Shift走る / ESC戻る）---- */
    _bindKeys: function () {
      var self = this;
      window.addEventListener('keydown', function (e) { self._key(e, true); }, { passive: false });
      window.addEventListener('keyup', function (e) { self._key(e, false); });
      // フォーカスが外れたら全キー解除（押しっぱ事故防止）
      window.addEventListener('blur', function () {
        self._keys.up = self._keys.down = self._keys.left = self._keys.right = self._keys.run = false;
      });
    },
    _key: function (e, down) {
      var k = (e.key || '').toLowerCase();
      var handled = true;
      if (k === 'w' || k === 'arrowup') this._keys.up = down;
      else if (k === 's' || k === 'arrowdown') this._keys.down = down;
      else if (k === 'a' || k === 'arrowleft') this._keys.left = down;
      else if (k === 'd' || k === 'arrowright') this._keys.right = down;
      else if (k === 'shift') this._keys.run = down;
      else if (k === 'escape') { if (down && this.active) this.exit(); }
      else handled = false;
      // 散策中は矢印キーのページスクロールを止める
      if (handled && this.active && k.indexOf('arrow') === 0) e.preventDefault();
    },

    /* ---- 散策モード開始 ---- */
    enter: function () {
      if (!this.player) this.init();
      this.active = true;
      if (window.City && City.controls) City.controls.enabled = false;
      // 通りの南端に立たせ、北（通天閣）を向く
      this.player.position.set(0, 0, -70);
      this._yaw = 0;
      this.player.rotation.y = 0;
      this.player.visible = true;
      this._placeCamera(true);
      this._showHint(true);
    },

    /* ---- 散策モード終了（全景の俯瞰に戻す）---- */
    exit: function () {
      this.active = false;
      if (this.player) this.player.visible = false;
      if (window.City && City.controls) City.controls.enabled = true;
      if (window.City && typeof City.reset === 'function') City.reset();
      this._showHint(false);
      // ESCで抜けた場合もボタン表示を戻す（UI と整合）
      var b = document.getElementById('btn-explore');
      if (b) b.textContent = '🎮 散策モード';
    },

    /* ---- 毎フレーム：入力→移動→衝突→向き→アニメ→カメラ ---- */
    _tick: function (dt) {
      if (!this.active || !this.player) return;
      if (dt > 0.1) dt = 0.1; // タブ復帰時の巨大dt対策

      var k = this._keys;
      var mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      var mz = (k.up ? 1 : 0) - (k.down ? 1 : 0);
      var moving = (mx !== 0 || mz !== 0);

      if (moving) {
        var len = Math.sqrt(mx * mx + mz * mz);
        mx /= len; mz /= len;
        var sp = (k.run ? this.SPEED_RUN : this.SPEED_WALK) * dt;
        var b = this.BOUNDS;
        // 範囲クランプ＝建物に入らない（通りだけ歩く）
        this.player.position.x = Math.max(b.xMin, Math.min(b.xMax, this.player.position.x + mx * sp));
        this.player.position.z = Math.max(b.zMin, Math.min(b.zMax, this.player.position.z + mz * sp));
        // 進行方向へ向く
        this._yaw = Math.atan2(mx, mz);
        this._walkPhase += dt * (k.run ? 15 : 10);
      }

      // キャラ回転を目標 yaw へ滑らかに補間（最短回り）
      var cy = this.player.rotation.y;
      var diff = this._yaw - cy;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.player.rotation.y = cy + diff * Math.min(1, dt * 12);

      // 脚・腕の歩行アニメ
      var swing = moving ? Math.sin(this._walkPhase) * 0.7 : 0;
      if (this._legL) this._legL.rotation.x = swing;
      if (this._legR) this._legR.rotation.x = -swing;
      if (this._armL) this._armL.rotation.x = -swing * 0.8;
      if (this._armR) this._armR.rotation.x = swing * 0.8;

      this._placeCamera(false);
    },

    /* ---- カメラをキャラ後方斜め上へ（instant=即時 / それ以外は緩く追従）---- */
    _placeCamera: function (instant) {
      if (!window.City || !City.camera) return;
      var p = this.player.position;
      var yaw = this.player.rotation.y;
      var ox = -Math.sin(yaw) * this.CAM_DIST;
      var oz = -Math.cos(yaw) * this.CAM_DIST;
      var target = new T.Vector3(p.x + ox, this.CAM_HEIGHT, p.z + oz);
      var cam = City.camera;
      if (instant) cam.position.copy(target);
      else cam.position.lerp(target, 0.12);
      cam.lookAt(p.x, p.y + 3.2, p.z);
    },

    /* ---- 操作ヒント（散策中のみ表示）---- */
    _showHint: function (show) {
      var h = document.getElementById('explore-hint');
      if (!h) {
        h = document.createElement('div');
        h.id = 'explore-hint';
        h.style.cssText =
          'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);' +
          'background:rgba(20,20,28,0.78);color:#fff;padding:8px 16px;border-radius:10px;' +
          'font:14px/1.4 system-ui,sans-serif;letter-spacing:.02em;z-index:50;' +
          'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);pointer-events:none;';
        document.body.appendChild(h);
      }
      h.textContent = 'WASD / 矢印キーで移動　・　Shiftで走る　・　ESC で戻る';
      h.style.display = show ? 'block' : 'none';
    }
  };

  window.Explore = Explore;
})();

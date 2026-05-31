/* =========================================================
   ui.js → window.UI
   情報パネル・昼夜トグル・視点リセット・凡例(#legend) の DOM 結線。
   §9 の契約に厳密に従う。UI は three.js の上に重ねた HTML/CSS を触るだけ。
   - #btn-night → City.setNight(!City.night)、ラベルを「☀ 昼にする」/「🌙 夜にする」でトグル
   - #btn-reset → City.reset() ＋ this.clearInfo()
   - #legend   → landmark/shop/statue/street の色チップ＋ラベルを生成、クリックで City.focusOn
   - #info-close→ this.clearInfo()
   - 起動時は info-panel を .hidden、#hint を数秒で薄くする
   ========================================================= */
(function () {
  'use strict';

  // 凡例項目（§9.2）。clickKey は City.objects から対象を探すための kind ヒント。
  // 対象が見つからない場合の保険として fallback 座標（{x,y,z}）も持つ。
  // ※ City.focusOn は Object3D / Vector3 / {x,y,z} を受ける契約（§1）。
  var LEGEND_ITEMS = [
    {
      icon: '🗼', label: '通天閣', kindClass: 'k-landmark', color: '#ffb347',
      kind: 'landmark',
      // TOWER_POS(0,0,28) を見上げる：足元ではなく中腹あたりを狙う
      fallback: { x: 0, y: 26, z: 28 }
    },
    {
      icon: '🏮', label: '商店街の店', kindClass: 'k-shop', color: '#e04a4a',
      kind: 'shop',
      // 通りの中ほど（西列W2付近の正面）を狙う
      fallback: { x: -16, y: 6, z: -28 }
    },
    {
      icon: '🧸', label: 'ビリケン', kindClass: 'k-statue', color: '#d9b34a',
      kind: 'statue',
      // props.js 推奨配置 (6,0,40) を見上げる
      fallback: { x: 6, y: 4, z: 40 }
    },
    {
      icon: '🛣', label: 'ジャンジャン横丁', kindClass: 'k-street', color: '#5a86c4',
      kind: 'street',
      // 通り（アーケード）の中央
      fallback: { x: 0, y: 4, z: -35 }
    }
  ];

  // kind → #info-panel に付けるアクセントクラス（CSS の .k-xxx と一致）
  var KIND_CLASSES = [
    'k-landmark', 'k-shop', 'k-statue', 'k-street', 'k-sign', 'k-prop'
  ];

  var UI = {

    // 内部に DOM 参照を保持（init で解決）
    _el: {
      panel: null,
      name: null,
      body: null,
      close: null,
      btnNight: null,
      btnReset: null,
      btnWalk: null,
      btnLookup: null,
      btnExplore: null,
      legend: null,
      hint: null
    },
    _hintTimer: null,

    /**
     * DOM へのイベント結線（§9 init）。
     * @returns {void}
     */
    init: function () {
      var d = document;
      var el = this._el;

      el.panel    = d.getElementById('info-panel');
      el.name     = d.getElementById('info-name');
      el.body     = d.getElementById('info-body');
      el.close    = d.getElementById('info-close');
      el.btnNight = d.getElementById('btn-night');
      el.btnReset = d.getElementById('btn-reset');
      el.btnWalk  = d.getElementById('btn-walk');
      el.btnLookup = d.getElementById('btn-lookup');
      el.btnExplore = d.getElementById('btn-explore');
      el.legend   = d.getElementById('legend');
      el.hint     = d.getElementById('hint');

      var self = this;

      // --- 昼夜トグル（§9: City.setNight(!City.night) → ラベルをトグル） ---
      if (el.btnNight) {
        el.btnNight.addEventListener('click', function () {
          // City が無い／未初期化でも UI が落ちないよう存在チェック
          if (window.City && typeof City.setNight === 'function') {
            City.setNight(!City.night);
          }
          self._syncNightLabel();
        });
      }

      // --- 視点リセット（§9: City.reset() ＋ clearInfo） ---
      if (el.btnReset) {
        el.btnReset.addEventListener('click', function () {
          if (window.City && typeof City.reset === 'function') {
            City.reset();
          }
          self.clearInfo();
        });
      }

      // --- 歩行者目線（City.walkView で通りに降りる） ---
      if (el.btnWalk) {
        el.btnWalk.addEventListener('click', function () {
          if (window.City && typeof City.walkView === 'function') {
            City.walkView();
          }
          self.clearInfo();
        });
      }

      // --- 見上げ（City.lookUp で頭上を見上げる） ---
      if (el.btnLookup) {
        el.btnLookup.addEventListener('click', function () {
          if (window.City && typeof City.lookUp === 'function') {
            City.lookUp();
          }
          self.clearInfo();
        });
      }

      // --- 散策モード（Explore.enter / exit トグル） ---
      if (el.btnExplore) {
        el.btnExplore.addEventListener('click', function () {
          if (!window.Explore) return;
          if (Explore.active) {
            Explore.exit();
            el.btnExplore.textContent = '🎮 散策モード';
          } else {
            self.clearInfo();
            Explore.enter();
            el.btnExplore.textContent = '✖ 散策をやめる';
          }
        });
      }

      // --- 情報パネルの×ボタン（clearInfo） ---
      if (el.close) {
        el.close.addEventListener('click', function () {
          self.clearInfo();
        });
      }

      // --- 凡例の生成（色チップ＋アイコン＋ラベル、クリックで focusOn） ---
      this._buildLegend();

      // --- 起動時：情報パネルは隠す、ヒントは数秒で薄く ---
      this.clearInfo();
      this._syncNightLabel();   // 起動は夜(City.night=true)なので「☀ 昼にする」
      this._scheduleHintFade();
    },

    /**
     * クリックされた対象の情報をパネルに表示（§9 showInfo）。
     * - userData.info の name→#info-name(textContent), body→#info-body(textContent)
     * - kind に応じて #info-panel のアクセント色クラスを付け替え
     * - .hidden を外す
     * @param {THREE.Object3D} obj  userData.info を持つ
     * @returns {void}
     */
    showInfo: function (obj) {
      var el = this._el;
      if (!el.panel) return;

      // info が無ければ何もしない（誤爆防止）
      var info = obj && obj.userData ? obj.userData.info : null;
      if (!info) {
        this.clearInfo();
        return;
      }

      // 見出し・本文（HTML を入れない＝textContent。改行 \n は CSS white-space:pre-line で表示）
      if (el.name) el.name.textContent = info.name || '';
      if (el.body) el.body.textContent = info.body || '';

      // kind 別アクセントクラスを付け替え
      this._setKindClass(info.kind);

      // 表示
      el.panel.classList.remove('hidden');
    },

    /**
     * 情報パネルを隠す（§9 clearInfo）。.hidden 付与＋内容クリア。
     * @returns {void}
     */
    clearInfo: function () {
      var el = this._el;
      if (!el.panel) return;
      el.panel.classList.add('hidden');
      if (el.name) el.name.textContent = '';
      if (el.body) el.body.textContent = '';
      this._setKindClass(null);   // アクセントクラスを全て外す
    },

    // ===== 内部ヘルパ =====

    /** #info-panel の kind クラスを 1つだけに整える（既存 k-* を外して付与）。 */
    _setKindClass: function (kind) {
      var panel = this._el.panel;
      if (!panel) return;
      // 既存の kind クラスを全て除去
      for (var i = 0; i < KIND_CLASSES.length; i++) {
        panel.classList.remove(KIND_CLASSES[i]);
      }
      if (!kind) return;
      var cls = 'k-' + kind;
      // 定義済みクラスのみ付与（未知 kind は無印＝既定色）
      if (KIND_CLASSES.indexOf(cls) !== -1) {
        panel.classList.add(cls);
      }
    },

    /** #btn-night のラベルを現在の City.night に同期。 */
    _syncNightLabel: function () {
      var btn = this._el.btnNight;
      if (!btn) return;
      // 夜なら「☀ 昼にする」、昼なら「🌙 夜にする」（§9 規約）
      var isNight = window.City ? !!City.night : true;
      btn.textContent = isNight ? '☀ 昼にする' : '🌙 夜にする';
    },

    /** 凡例 DOM を生成。各項目クリックで対応オブジェクトに City.focusOn。 */
    _buildLegend: function () {
      var legend = this._el.legend;
      if (!legend) return;

      // 中身を一旦空に（再生成にも耐える）
      while (legend.firstChild) legend.removeChild(legend.firstChild);

      // 見出し
      var title = document.createElement('div');
      title.className = 'legend-title';
      title.textContent = '凡例（クリックで注目）';
      legend.appendChild(title);

      var self = this;

      LEGEND_ITEMS.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'legend-item';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.title = item.label + 'に注目する';

        // 色チップ（丸）
        var chip = document.createElement('span');
        chip.className = 'chip';
        chip.style.background = item.color;

        // アイコン
        var ico = document.createElement('span');
        ico.className = 'ico';
        ico.textContent = item.icon;

        // ラベル
        var lab = document.createElement('span');
        lab.className = 'lab';
        lab.textContent = item.label;

        row.appendChild(chip);
        row.appendChild(ico);
        row.appendChild(lab);

        // クリック → focusOn（対象を City.objects から解決、無ければ fallback 座標）
        var handler = function () { self._focusLegend(item); };
        row.addEventListener('click', handler);
        // キーボード操作（Enter / Space）にも対応
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            handler();
          }
        });

        legend.appendChild(row);
      });
    },

    /**
     * 凡例項目に対応するオブジェクトへカメラを寄せる。
     * City.objects から userData.info.kind が一致する最初の対象を探し、
     * 見つかれば Object3D を、無ければ fallback の {x,y,z} を City.focusOn に渡す。
     */
    _focusLegend: function (item) {
      if (!window.City || typeof City.focusOn !== 'function') return;

      var target = this._findByKind(item.kind);
      if (target) {
        City.focusOn(target);                 // 情報親 Group を直接フォーカス
      } else {
        City.focusOn(item.fallback);          // 座標フォールバック（契約：{x,y,z} 可）
      }
    },

    /** City.objects から userData.info.kind が一致する最初のオブジェクトを返す。 */
    _findByKind: function (kind) {
      if (!window.City || !Array.isArray(City.objects)) return null;
      for (var i = 0; i < City.objects.length; i++) {
        var o = City.objects[i];
        var info = o && o.userData ? o.userData.info : null;
        if (info && info.kind === kind) return o;
      }
      // street が無い場合は landmark を最後の保険にはしない（fallback 座標に任せる）
      return null;
    },

    /** ヒントを一定時間後にフェードアウト。 */
    _scheduleHintFade: function () {
      var hint = this._el.hint;
      if (!hint) return;
      if (this._hintTimer) clearTimeout(this._hintTimer);
      // 6秒表示してから .faded で 1.4秒かけて消す（css 側の transition）
      this._hintTimer = setTimeout(function () {
        hint.classList.add('faded');
      }, 6000);
    }
  };

  // グローバル公開（§0：window.XXX で公開）
  window.UI = UI;
})();

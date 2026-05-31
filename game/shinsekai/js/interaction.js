/* =========================================================================
 * interaction.js  →  window.Interaction
 * -------------------------------------------------------------------------
 * 3Dジオラマ「ミニチュア新世界」のマウス操作担当。
 *
 * 役割（DESIGN.md §8 の契約に厳密準拠）:
 *   - Raycaster を1つ作り、canvas(City.renderer.domElement) に
 *     pointermove / pointerdown / pointerup(click相当) を登録する。
 *   - クリック: 画面座標→NDC→raycaster.setFromCamera→
 *     intersectObjects(City.objects, true)。最初のヒットから
 *     userData.cityRoot（無ければ parent 連鎖）で「情報を持つ親」を解決。
 *     解決できたら UI.showInfo(root) と City.focusOn(root)。
 *     何もヒットしなければ UI.clearInfo()。
 *   - ホバー: 情報を持つ対象に当たっていれば cursor='pointer'、
 *     外れたら 'grab'（OrbitControls の掴み感）。
 *     ホバー対象には薄いハイライト（scale 1.02、outline代替）。
 *   - ドラッグ中に発火したクリックは無視（カメラ回転との誤爆防止）。
 *     pointerdown 座標を記録し、pointerup 時の移動量 < 5px のときのみ click 扱い。
 *
 * 依存: window.City（scene.js）, window.UI（ui.js）, グローバル THREE。
 * 公開: window.Interaction（末尾で代入）。import/export/require は使わない。
 * ========================================================================= */

(function () {
  'use strict';

  // ----- モジュール内部状態（クロージャに閉じ込める。外部公開は init のみ） -----

  // Raycaster は契約どおり1つだけ保持して使い回す（毎回 new しない＝負荷対策）。
  var _raycaster = new THREE.Raycaster();

  // NDC（正規化デバイス座標 -1〜+1）を入れる作業用 Vector2。毎フレーム再生成しない。
  var _ndc = new THREE.Vector2();

  // クリック誤爆防止のための、pointerdown 押下開始座標（CSSピクセル）。
  var _downX = 0;
  var _downY = 0;
  // 現在ポインタが「押下中」か（pointerdown〜pointerup の間 true）。
  var _pointerDown = false;

  // ドラッグ判定のしきい値。押下開始から pointerup までの移動量がこれ未満なら
  // 「クリック」とみなす。これ以上動いていたらカメラ回転（ドラッグ）と判断して無視。
  var DRAG_THRESHOLD_PX = 5;

  // 現在ホバー中の「情報を持つ親（cityRoot）」。ハイライトの付け外しに使う。
  var _hovered = null;

  // ハイライト時に拡大した分を元へ戻すため、対象ごとに「元のスケール」を覚えておく。
  // WeakMap が使えればオブジェクト消滅時に自動回収されるので最優先で使う。
  var _baseScale = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;

  // ホバーで一時的に掛ける拡大率（DESIGN.md §8: outline代替の scale 1.02）。
  var HOVER_SCALE = 1.02;

  // 二重初期化を防ぐフラグ。
  var _initialized = false;


  // ---------------------------------------------------------------------
  // ヘルパ: イベント座標 → NDC（正規化デバイス座標）
  //   契約式（DESIGN.md §8 末尾）:
  //     x = (clientX / innerWidth)  * 2 - 1
  //     y = -(clientY / innerHeight) * 2 + 1
  //   ※ canvas は #app に全画面(fixed inset0)で敷かれている前提なので、
  //     画面サイズ（innerWidth/innerHeight）基準で正しく一致する。
  //     念のため canvas が画面いっぱいでない場合にも破綻しないよう
  //     getBoundingClientRect でフォールバックも用意する。
  // ---------------------------------------------------------------------
  function toNDC(ev, out) {
    var dom = (window.City && City.renderer) ? City.renderer.domElement : null;

    var w = window.innerWidth;
    var h = window.innerHeight;
    var offsetX = 0;
    var offsetY = 0;

    // canvas が画面全体でない（位置やサイズがズレている）場合に備えて、
    // 実DOM矩形を見て補正する。全画面なら left=top=0・width=innerWidth なので
    // 契約式とまったく同じ結果になる。
    if (dom && dom.getBoundingClientRect) {
      var r = dom.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        w = r.width;
        h = r.height;
        offsetX = r.left;
        offsetY = r.top;
      }
    }

    out.x = ((ev.clientX - offsetX) / w) * 2 - 1;
    out.y = -((ev.clientY - offsetY) / h) * 2 + 1;
    return out;
  }


  // ---------------------------------------------------------------------
  // ヘルパ: Raycast ヒットメッシュ → 「情報を持つ親(cityRoot)」を解決
  //   1) まず userData.cityRoot を見る（register() が自動付与している契約）。
  //   2) 無ければ parent を上へ辿り、userData.cityRoot か userData.info を
  //      持つ祖先を探す（保険）。
  //   3) それでも見つからなければ null。
  // ---------------------------------------------------------------------
  function resolveRoot(hitObject) {
    var node = hitObject;
    while (node) {
      if (node.userData) {
        // 本命: register() が子孫全部に張った cityRoot。
        if (node.userData.cityRoot) {
          return node.userData.cityRoot;
        }
        // 保険: cityRoot が無くても info を直接持つノードなら、それを親とみなす。
        if (node.userData.info) {
          return node;
        }
      }
      node = node.parent;
    }
    return null;
  }


  // ---------------------------------------------------------------------
  // ヘルパ: Raycast を実行して最初の有効ヒットの「情報親」を返す
  //   - City.objects（情報を持つ登録オブジェクト群）を再帰(true)で交差判定。
  //   - 交差は near 昇順で返るので、先頭から見て最初に root 解決できたものを採用。
  //   - 解決できなければ null。
  // ---------------------------------------------------------------------
  function pickRoot(ev) {
    if (!window.City || !City.camera || !Array.isArray(City.objects)) {
      return null;
    }
    if (City.objects.length === 0) {
      return null;
    }

    toNDC(ev, _ndc);
    _raycaster.setFromCamera(_ndc, City.camera);

    // 第2引数 true = 子孫メッシュまで再帰的に交差判定（建物Group等は子にメッシュを持つ）。
    var hits = _raycaster.intersectObjects(City.objects, true);

    for (var i = 0; i < hits.length; i++) {
      var root = resolveRoot(hits[i].object);
      if (root) {
        return root;
      }
    }
    return null;
  }


  // ---------------------------------------------------------------------
  // ヘルパ: ホバーのハイライト切替（scale 1.02。outlineの軽量代替）
  //   - 新しい対象に入ったら、古い対象のスケールを元に戻し、新対象を 1.02 倍。
  //   - 同じ対象なら何もしない（毎フレーム掛け算で膨張するのを防ぐ）。
  // ---------------------------------------------------------------------
  function setHover(root) {
    if (root === _hovered) {
      return; // 変化なし
    }

    // 直前のホバー対象があれば、覚えておいた元スケールへ戻す。
    if (_hovered) {
      restoreScale(_hovered);
    }

    _hovered = root;

    // 新しい対象があれば、元スケールを記録してから 1.02 倍に拡大。
    if (_hovered && _hovered.scale) {
      rememberScale(_hovered);
      _hovered.scale.multiplyScalar(HOVER_SCALE);
    }
  }

  // 対象の現在スケールを「元の値」として一度だけ記録する。
  function rememberScale(obj) {
    if (!obj || !obj.scale) return;
    if (_baseScale) {
      if (!_baseScale.has(obj)) {
        _baseScale.set(obj, obj.scale.clone());
      }
    } else {
      // WeakMap非対応環境向けフォールバック: userData に退避。
      if (!obj.userData) obj.userData = {};
      if (!obj.userData.__baseScale) {
        obj.userData.__baseScale = obj.scale.clone();
      }
    }
  }

  // 記録しておいた元スケールへ戻す。
  function restoreScale(obj) {
    if (!obj || !obj.scale) return;
    var base = null;
    if (_baseScale) {
      base = _baseScale.get(obj) || null;
    } else if (obj.userData) {
      base = obj.userData.__baseScale || null;
    }
    if (base) {
      obj.scale.copy(base);
    }
  }


  // ---------------------------------------------------------------------
  // ヘルパ: カーソル形状を設定（情報対象なら pointer、それ以外は grab）
  //   - grab は OrbitControls の「掴んで回す」感に合わせた既定カーソル。
  // ---------------------------------------------------------------------
  function setCursor(isPointer) {
    var dom = (window.City && City.renderer) ? City.renderer.domElement : null;
    if (!dom) return;
    dom.style.cursor = isPointer ? 'pointer' : 'grab';
  }


  // =====================================================================
  // イベントハンドラ
  // =====================================================================

  // --- pointermove: ホバー判定（カーソル形状＋薄いハイライト） ---
  function onPointerMove(ev) {
    // 押下中（＝カメラをドラッグ回転している最中）はホバー判定をしない。
    // 回転中に建物へ吸い付いて拡大/カーソル変化が起きると鬱陶しいため、
    // 掴み中は 'grabbing' を出して静かにする。
    if (_pointerDown) {
      var dom = (window.City && City.renderer) ? City.renderer.domElement : null;
      if (dom) dom.style.cursor = 'grabbing';
      return;
    }

    var root = pickRoot(ev);

    // カーソル: 情報対象に乗っていれば pointer、外れていれば grab。
    setCursor(!!root);

    // 薄いハイライト（scale 1.02）。対象が変わったときだけ更新。
    setHover(root);
  }

  // --- pointerdown: 押下開始座標を記録（クリック/ドラッグ判定の起点） ---
  function onPointerDown(ev) {
    // 主ボタン(左クリック/タップ)以外は無視。右クリック等でフォーカスさせない。
    if (typeof ev.button === 'number' && ev.button !== 0) {
      return;
    }
    _pointerDown = true;
    _downX = ev.clientX;
    _downY = ev.clientY;
  }

  // --- pointerup: 移動量で「クリック」か「ドラッグ」かを判定して処理 ---
  function onPointerUp(ev) {
    // 押下していなかった up（別要素から流れてきた等）は無視。
    if (!_pointerDown) {
      return;
    }
    _pointerDown = false;

    // 主ボタン以外で終わった操作は無視。
    if (typeof ev.button === 'number' && ev.button !== 0) {
      return;
    }

    // 押下開始からの移動量を算出。しきい値(5px)以上動いていたら
    // 「カメラ回転（ドラッグ）」とみなしてクリック処理しない＝誤爆防止。
    var dx = ev.clientX - _downX;
    var dy = ev.clientY - _downY;
    var moved = Math.sqrt(dx * dx + dy * dy);
    if (moved >= DRAG_THRESHOLD_PX) {
      // ドラッグだったので、終了後のカーソルだけ整える（情報対象なら pointer）。
      var rootAfterDrag = pickRoot(ev);
      setCursor(!!rootAfterDrag);
      setHover(rootAfterDrag);
      return;
    }

    // ここまで来たら「クリック」確定。Raycast で情報親を解決する。
    var root = pickRoot(ev);

    if (root) {
      // 情報を持つ対象をクリック → 情報パネル表示＋カメラを寄せる。
      // UI / City が読み込まれていない不測のケースでも全体が落ちないよう存在確認。
      if (window.UI && typeof UI.showInfo === 'function') {
        UI.showInfo(root);
      }
      if (window.City && typeof City.focusOn === 'function') {
        City.focusOn(root);
      }
    } else {
      // 何もない場所（空・地面）をクリック → 情報パネルを閉じる。
      if (window.UI && typeof UI.clearInfo === 'function') {
        UI.clearInfo();
      }
    }
  }

  // --- ポインタが canvas から出たとき: ハイライトとカーソルを元へ ---
  function onPointerLeave() {
    setHover(null);   // 拡大していた対象を元のスケールに戻す
    setCursor(false); // grab に戻す
  }

  // --- ポインタ操作がOS等にキャンセルされたとき: 押下状態を解除 ---
  function onPointerCancel() {
    _pointerDown = false;
    setHover(null);
    setCursor(false);
  }


  // =====================================================================
  // 公開オブジェクト
  // =====================================================================
  window.Interaction = {

    /**
     * Raycaster を作り、canvas に pointer 系イベントを結線する。
     * main.js（§10）から Interaction.init() として1回だけ呼ばれる契約。
     * @returns {void}
     */
    init: function () {
      if (_initialized) {
        return; // 二重結線防止
      }

      // City.init() 済み＝renderer.domElement が存在している前提。
      // まだ無ければ何も結線できないので警告して終了（main の起動順を守れば起きない）。
      if (!window.City || !City.renderer || !City.renderer.domElement) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Interaction] City.renderer.domElement が未準備です。City.init() の後に Interaction.init() を呼んでください。');
        }
        return;
      }

      var dom = City.renderer.domElement;

      // 初期カーソルは grab（OrbitControls の掴み感）。
      dom.style.cursor = 'grab';

      // 右クリックのコンテキストメニューは 3D 操作の邪魔なので抑止（任意だが体験向上）。
      dom.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      // ホバー（カーソル形状＋ハイライト）。passive:true で描画をブロックしない。
      dom.addEventListener('pointermove', onPointerMove, { passive: true });

      // クリック/ドラッグ判定: down で起点記録、up で移動量を見て分岐。
      dom.addEventListener('pointerdown', onPointerDown, { passive: true });
      dom.addEventListener('pointerup', onPointerUp, { passive: true });

      // canvas外へポインタが抜けた/キャンセルされた場合の後始末。
      dom.addEventListener('pointerleave', onPointerLeave, { passive: true });
      dom.addEventListener('pointercancel', onPointerCancel, { passive: true });

      _initialized = true;
    }
  };

})();

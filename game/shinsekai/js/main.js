/* =========================================================
   main.js — 起動順（§10 固定）
   window.onload で各モジュールを契約どおりの順に呼ぶだけ。
   各 build() は内部で City.scene.add(...) / City.register(...) を行う。
   main は順番を守って呼ぶのが仕事（順序を変えない）。
   ========================================================= */
(function () {
  'use strict';

  /**
   * 起動本体。§10 の順序を厳守する：
   *   1. City.init()        scene/camera/renderer/controls/ライティング/地面
   *   2. Tower.build()      通天閣
   *   3. Buildings.build()  アーケード＋雑居ビル12棟
   *   4. Props.build()      提灯・暖簾・立体看板・ビリケン・街灯・人影
   *   5. Interaction.init() Raycaster / クリック・ホバー
   *   6. UI.init()          情報パネル・昼夜トグル・リセット・凡例
   *   7. City.start()       rAFループ開始（夜景デフォルト）
   */
  function run() {
    // 依存モジュールの存在を確認（読み込み順ミスを早期に可視化）。
    // 1つでも欠ければ何が足りないかを明示して停止する。
    var required = ['City', 'Tex', 'Tower', 'Buildings', 'Props', 'Interaction', 'UI'];
    var missing = [];
    for (var i = 0; i < required.length; i++) {
      if (typeof window[required[i]] === 'undefined') {
        missing.push(required[i]);
      }
    }
    // THREE / OrbitControls（ライブラリ）も確認
    if (typeof window.THREE === 'undefined') missing.push('THREE');
    else if (typeof THREE.OrbitControls === 'undefined') missing.push('THREE.OrbitControls');

    if (missing.length) {
      console.error(
        '[ミニチュア新世界] 必要なモジュールが読み込まれていません: ' +
        missing.join(', ') +
        '\nindex.html の <script> 読み込み順（lib → scene → textures → tower → buildings → props → interaction → ui → main）を確認してください。'
      );
      return;
    }

    try {
      City.init();          // 1. scene/camera/renderer/controls/ライティング/地面
      Tower.build();        // 2. 通天閣
      Buildings.build();    // 3. アーケード＋雑居ビル12棟
      Props.build();        // 4. 提灯・暖簾・立体看板・ビリケン・街灯・人影
      Interaction.init();   // 5. Raycaster / クリック・ホバー
      UI.init();            // 6. 情報パネル・昼夜トグル・リセット・凡例
      if (window.Explore && typeof Explore.init === 'function') Explore.init(); // 6.5 散策モード（任意・あれば初期化）
      City.start();         // 7. rAFループ開始（夜景デフォルト）
    } catch (err) {
      // 起動中の例外はコンソールに明示（画面が真っ暗な原因を追えるように）
      console.error('[ミニチュア新世界] 起動中にエラーが発生しました:', err);
      throw err;
    }
  }

  // §10 注記：onload 競合に強い形で起動（挙動は window.onload と同一）。
  // すでに読み込み完了なら即実行、まだなら load を待つ。
  if (document.readyState !== 'loading') {
    // DOMが既に利用可能（このスクリプトが body 末尾にある通常ケースを含む）
    run();
  } else {
    window.addEventListener('load', run);
  }
})();

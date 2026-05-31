/* ============================================================================
 * textures.js  →  window.Tex
 * ----------------------------------------------------------------------------
 * 大阪・新世界ジオラマのテクスチャを「すべて Canvas プロシージャル」で生成する。
 * 画像ファイル・外部フォント・外部URLは一切使わない（DESIGN.md §0 / §4 準拠）。
 *
 * - 日本語文字は system-ui（OSバンドルフォント）を ctx.fillText で描く。
 * - 返り値はすべて THREE.CanvasTexture。返す前に needsUpdate=true。
 * - 「色として見せる」テクスチャ（看板・壁・空・提灯・暖簾・道路・ビリケン・名物）は
 *   tex.encoding = THREE.sRGBEncoding を付ける。
 * - neon() だけは emissiveMap 用途（黒背景＋発光文字）。色そのものを足すので sRGB を付ける。
 * - 繰り返すもの（道路・壁タイル）は RepeatWrapping、看板など一点ものは ClampToEdge。
 *
 * r137 API 厳守:
 *   tex.encoding = THREE.sRGBEncoding;  (outputColorSpace は無い)
 *   tex.wrapS / tex.wrapT = THREE.RepeatWrapping / THREE.ClampToEdgeWrapping;
 * ==========================================================================*/

window.Tex = (function () {
  "use strict";

  // ===========================================================================
  // 内部ヘルパ（公開不要）
  // ===========================================================================

  // <canvas> を生成して 2D コンテキストごと返す。
  function _canvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");
    return { canvas: c, ctx: ctx, w: w, h: h };
  }

  /**
   * CanvasTexture 化して各種フラグを設定して返す共通処理。
   * @param {HTMLCanvasElement} canvas
   * @param {object} [o] { repeat:[rx,ry] で RepeatWrapping, clamp:true で ClampToEdge,
   *                        srgb:true(既定) で sRGBEncoding, aniso:数 で異方性 }
   */
  function _finalize(canvas, o) {
    o = o || {};
    var tex = new THREE.CanvasTexture(canvas);

    // 色として使うものは sRGB（既定 true）。emissiveMap でも色を足すので true でよい。
    if (o.srgb !== false) {
      tex.encoding = THREE.sRGBEncoding;
    }

    // 繰り返し or クランプ
    if (o.repeat) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(o.repeat[0], o.repeat[1]);
    } else {
      // 看板・壁・提灯など一点ものは端を伸ばさずクランプ（縁のにじみ防止）
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }

    // ミップマップ＋斜め見の鮮明さ（端末が許す範囲で）
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (typeof o.aniso === "number") tex.anisotropy = o.aniso;

    tex.needsUpdate = true;
    return tex;
  }

  // 角丸矩形パス
  function _roundRect(ctx, x, y, w, h, r) {
    if (r < 0) r = 0;
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // #rrggbb を {r,g,b} へ
  function _hex2rgb(hex) {
    hex = (hex || "#000000").replace("#", "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function _rgba(hex, a) {
    var c = _hex2rgb(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
  }
  // 色を明るく/暗く（amt: -1〜+1）
  function _shade(hex, amt) {
    var c = _hex2rgb(hex);
    function f(v) {
      if (amt >= 0) return Math.round(v + (255 - v) * amt);
      return Math.round(v * (1 + amt));
    }
    return "rgb(" + f(c.r) + "," + f(c.g) + "," + f(c.b) + ")";
  }

  // 文字を縁取り（太く）→ 本体の順で描く。日本語OK（system-ui）。
  function _outlinedText(ctx, text, x, y, opt) {
    opt = opt || {};
    ctx.save();
    ctx.textAlign = opt.align || "center";
    ctx.textBaseline = opt.baseline || "middle";
    ctx.font = opt.font || "bold 64px system-ui";
    if (opt.shadow) {
      ctx.shadowColor = opt.shadow;
      ctx.shadowBlur = opt.shadowBlur || 12;
    }
    // 太い縁取り（複数回 stroke で“極太縁取り”の新世界看板らしさ）
    if (opt.stroke) {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = opt.stroke;
      var lw = opt.lineWidth || 10;
      ctx.lineWidth = lw;
      ctx.strokeText(text, x, y);
      // さらに細い内側縁取りで階調を出す（任意）
      if (opt.stroke2) {
        ctx.lineWidth = lw * 0.5;
        ctx.strokeStyle = opt.stroke2;
        ctx.strokeText(text, x, y);
      }
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = opt.fill || "#ffffff";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // 縦書き（1文字ずつ縦に並べる）。日本語の看板/提灯/暖簾向け。
  function _verticalText(ctx, text, cx, topY, lineH, opt) {
    opt = opt || {};
    var chars = Array.from(text); // サロゲートペア安全
    for (var i = 0; i < chars.length; i++) {
      _outlinedText(ctx, chars[i], cx, topY + lineH * (i + 0.5), opt);
    }
  }

  // フォントサイズ自動調整（横書き1行が枠に収まるよう px を縮める）
  function _fitFontPx(ctx, text, maxW, startPx, weight) {
    weight = weight || "bold";
    var px = startPx;
    do {
      ctx.font = weight + " " + px + "px system-ui";
      if (ctx.measureText(text).width <= maxW) break;
      px -= 2;
    } while (px > 10);
    return px;
  }

  // 軽いノイズ（汚し）を矩形領域に乗せる
  function _grain(ctx, x, y, w, h, amount, dark) {
    var n = Math.floor((w * h) / 90) * amount;
    ctx.save();
    for (var i = 0; i < n; i++) {
      var px = x + Math.random() * w;
      var py = y + Math.random() * h;
      var a = Math.random() * 0.12;
      ctx.fillStyle = dark
        ? "rgba(0,0,0," + a + ")"
        : "rgba(255,255,255," + a * 0.7 + ")";
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.restore();
  }

  // ===========================================================================
  // 1) signboard — 派手な袖看板/壁面看板（極太日本語・縁取り）
  // ===========================================================================
  /**
   * @param {string} text 例 "串カツ" "ホルモン" "ふぐ" "将棋"
   * @param {string} [bg="#c01a1a"]
   * @param {string} [fg="#fff3c0"]
   * @param {object} [opt] { vertical:true, w:256, h:256, border:"#ffd24a", glow:false }
   */
  function signboard(text, bg, fg, opt) {
    opt = opt || {};
    bg = bg || "#c01a1a";
    fg = fg || "#fff3c0";
    var border = opt.border || "#ffd24a";
    var vertical = opt.vertical === true; // 既定は横書き（袖看板は縦も使う側で指定）
    var w = opt.w || 256;
    var h = opt.h || 256;
    var t = text || "看板";

    var p = _canvas(w, h);
    var ctx = p.ctx;

    // ベース背景（上下で僅かに濃淡＝鉄板の照り）
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, _shade(bg, 0.12));
    g.addColorStop(0.5, bg);
    g.addColorStop(1, _shade(bg, -0.18));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 太い縁（看板枠）— 外枠＋内枠の二重で派手に
    var m = Math.round(Math.min(w, h) * 0.06);
    ctx.lineWidth = Math.round(Math.min(w, h) * 0.05);
    ctx.strokeStyle = border;
    _roundRect(ctx, m, m, w - m * 2, h - m * 2, Math.round(Math.min(w, h) * 0.06));
    ctx.stroke();
    ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.015));
    ctx.strokeStyle = _shade(border, -0.35);
    _roundRect(
      ctx,
      m * 1.7,
      m * 1.7,
      w - m * 3.4,
      h - m * 3.4,
      Math.round(Math.min(w, h) * 0.045)
    );
    ctx.stroke();

    // 角の電飾ランプ（玉電球）—新世界らしい賑やかさ
    var bulbR = Math.max(3, Math.round(Math.min(w, h) * 0.016));
    var pad = m + bulbR * 1.5;
    var bulbColor = "#ffe089";
    function bulbRow(x0, y0, x1, y1, count) {
      for (var i = 0; i < count; i++) {
        var u = count === 1 ? 0 : i / (count - 1);
        var bx = x0 + (x1 - x0) * u;
        var by = y0 + (y1 - y0) * u;
        ctx.beginPath();
        ctx.fillStyle = bulbColor;
        ctx.arc(bx, by, bulbR, 0, Math.PI * 2);
        ctx.fill();
        // 玉の光彩
        ctx.beginPath();
        ctx.fillStyle = _rgba("#fff7d0", 0.5);
        ctx.arc(bx - bulbR * 0.3, by - bulbR * 0.3, bulbR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    var nx = Math.max(4, Math.round(w / 42));
    var ny = Math.max(4, Math.round(h / 42));
    bulbRow(pad, pad, w - pad, pad, nx); // 上辺
    bulbRow(pad, h - pad, w - pad, h - pad, nx); // 下辺
    bulbRow(pad, pad, pad, h - pad, ny); // 左辺
    bulbRow(w - pad, pad, w - pad, h - pad, ny); // 右辺

    // 文字（極太・縁取り）。発光指定 glow:true なら影でにじませる。
    var textOpt = {
      fill: fg,
      stroke: "#1a0c08", // 黒に近い濃い縁
      stroke2: _shade(fg, -0.4),
      lineWidth: Math.round(Math.min(w, h) * 0.045),
      shadow: opt.glow ? fg : null,
      shadowBlur: opt.glow ? 24 : 0,
    };

    var innerW = w - pad * 2.4;
    var innerH = h - pad * 2.4;

    if (vertical) {
      // 縦書き：文字数で行高を決めて中央に
      var chars = Array.from(t);
      var lineH = Math.min(innerH / chars.length, w * 0.62);
      var fpx = Math.round(lineH * 0.82);
      textOpt.font = "900 " + fpx + "px system-ui";
      textOpt.lineWidth = Math.max(6, Math.round(fpx * 0.12));
      var totalH = lineH * chars.length;
      _verticalText(ctx, t, w / 2, h / 2 - totalH / 2, lineH, textOpt);
    } else {
      // 横書き：1行に収める（長い語は自動縮小）。2〜3文字想定で大きく。
      var basePx = Math.round(Math.min(innerW / Math.max(t.length, 1) * 1.25, innerH * 0.8));
      var fpx2 = _fitFontPx(ctx, t, innerW, basePx, "900");
      textOpt.font = "900 " + fpx2 + "px system-ui";
      textOpt.lineWidth = Math.max(6, Math.round(fpx2 * 0.11));
      _outlinedText(ctx, t, w / 2, h / 2 + fpx2 * 0.02, textOpt);
    }

    // ほんのり汚し（屋外看板の年季）
    _grain(ctx, 0, 0, w, h, 0.5, true);

    return _finalize(p.canvas, { clamp: true, srgb: true, aniso: 4 });
  }

  // ===========================================================================
  // 2) wall — 雑居ビルの壁（窓・タイル・配管・室外機。夜は窓が点灯）
  // ===========================================================================
  /**
   * @param {object} [opt] { base:"#8a7f74", floors:4, windows:true, night:false, w:256, h:512 }
   */
  function wall(opt) {
    opt = opt || {};
    var base = opt.base || "#8a7f74";
    var floors = opt.floors || 4;
    var windows = opt.windows !== false;
    var night = opt.night === true;
    var w = opt.w || 256;
    var h = opt.h || 512;

    var p = _canvas(w, h);
    var ctx = p.ctx;

    // 壁ベース（上ほど明るい＝空の照り返し）
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, _shade(base, night ? -0.25 : 0.1));
    g.addColorStop(1, _shade(base, night ? -0.5 : -0.12));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // タイル目地（細い横線・縦線）— 雑居ビルの面のリズム
    ctx.strokeStyle = _rgba("#000000", night ? 0.22 : 0.12);
    ctx.lineWidth = 1;
    var tileX = Math.max(4, Math.round(w / 8));
    var tileY = Math.max(4, Math.round(h / 24));
    for (var ty = 0; ty <= h; ty += tileY) {
      ctx.beginPath();
      ctx.moveTo(0, ty + 0.5);
      ctx.lineTo(w, ty + 0.5);
      ctx.stroke();
    }
    for (var tx = 0; tx <= w; tx += tileX) {
      ctx.beginPath();
      ctx.moveTo(tx + 0.5, 0);
      ctx.lineTo(tx + 0.5, h);
      ctx.stroke();
    }

    // 各階に窓列。最下階は店舗の開口（庇＋暖簾色帯）として扱う。
    var floorH = h / floors;
    var winColsBase = 3; // 1階あたりの窓列
    var litColor = Math.random() < 0.5 ? "#ffe39a" : "#fff6d8"; // 点灯色（暖色）
    var coolLit = "#bfe2ff"; // 一部蛍光灯っぽい寒色

    for (var f = 0; f < floors; f++) {
      var fy0 = h - floorH * (f + 1); // 下から数える（f=0が1階）
      var isGround = f === 0;

      // 階の床スラブ（横帯）
      ctx.fillStyle = _rgba("#000000", 0.18);
      ctx.fillRect(0, fy0 + floorH - Math.max(2, floorH * 0.04), w, Math.max(2, floorH * 0.04));

      if (!windows) continue;

      if (isGround) {
        // 1階＝店舗ファサード：大きな開口＋庇。夜は店内が明るい。
        var opH = floorH * 0.62;
        var opY = fy0 + floorH - opH - floorH * 0.08;
        var opX = w * 0.08;
        var opW = w * 0.84;
        // 店内（夜=明るい暖色、昼=暗めガラス）
        var ig = ctx.createLinearGradient(0, opY, 0, opY + opH);
        if (night) {
          ig.addColorStop(0, "#ffcf7a");
          ig.addColorStop(1, "#b8761f");
        } else {
          ig.addColorStop(0, "#2a2f36");
          ig.addColorStop(1, "#171a1f");
        }
        ctx.fillStyle = ig;
        ctx.fillRect(opX, opY, opW, opH);
        // ガラスの桟
        ctx.strokeStyle = _rgba("#15110c", 0.8);
        ctx.lineWidth = Math.max(2, w * 0.012);
        ctx.strokeRect(opX, opY, opW, opH);
        ctx.beginPath();
        ctx.moveTo(opX + opW / 3, opY);
        ctx.lineTo(opX + opW / 3, opY + opH);
        ctx.moveTo(opX + (opW * 2) / 3, opY);
        ctx.lineTo(opX + (opW * 2) / 3, opY + opH);
        ctx.stroke();
        // 庇（テント）赤白ストライプ
        var awY = opY - floorH * 0.1;
        var awH = floorH * 0.14;
        var stripeN = 8;
        for (var s = 0; s < stripeN; s++) {
          ctx.fillStyle = s % 2 ? "#d4d0c4" : "#b3322a";
          ctx.fillRect(opX + (opW / stripeN) * s, awY, opW / stripeN + 1, awH);
        }
        // 庇の下端ギザギザ
        ctx.fillStyle = "#9a2a23";
        ctx.beginPath();
        var teeth = stripeN;
        for (var tt = 0; tt <= teeth; tt++) {
          var xx = opX + (opW / teeth) * tt;
          ctx.lineTo(xx, awY + awH);
          ctx.lineTo(xx + opW / teeth / 2, awY + awH + awH * 0.5);
        }
        ctx.lineTo(opX + opW, awY + awH);
        ctx.closePath();
        ctx.fill();
      } else {
        // 上階＝窓列。一部だけ点灯（夜）。
        var cols = winColsBase;
        var winW = (w * 0.7) / cols;
        var gap = (w - winW * cols) / (cols + 1);
        var winH = floorH * 0.46;
        var winY = fy0 + floorH * 0.22;
        for (var c = 0; c < cols; c++) {
          var winX = gap + (winW + gap) * c;
          var lit = night && Math.random() < 0.62; // 夜は6割くらい点灯
          // 窓ガラス
          if (lit) {
            var col = Math.random() < 0.25 ? coolLit : litColor;
            ctx.fillStyle = col;
          } else {
            ctx.fillStyle = night ? "#11151c" : "#7d93a6";
          }
          ctx.fillRect(winX, winY, winW, winH);
          // サッシ枠
          ctx.strokeStyle = _rgba("#0c0a08", 0.85);
          ctx.lineWidth = Math.max(1, w * 0.006);
          ctx.strokeRect(winX, winY, winW, winH);
          // 桟（十字）
          ctx.beginPath();
          ctx.moveTo(winX + winW / 2, winY);
          ctx.lineTo(winX + winW / 2, winY + winH);
          ctx.moveTo(winX, winY + winH / 2);
          ctx.lineTo(winX + winW, winY + winH / 2);
          ctx.stroke();
          // 点灯窓のにじみ（夜）
          if (lit) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.shadowColor = ctx.fillStyle;
          }
          // 室外機（一部の窓脇に）
          if (!isGround && Math.random() < 0.3) {
            var acW = winW * 0.5;
            var acH = winH * 0.32;
            var acX = winX + winW - acW * 0.2;
            var acY = winY + winH + 2;
            if (acY + acH < fy0 + floorH) {
              ctx.fillStyle = night ? "#3a3f47" : "#cfcabd";
              ctx.fillRect(acX, acY, acW, acH);
              ctx.strokeStyle = _rgba("#000", 0.4);
              ctx.lineWidth = 1;
              ctx.strokeRect(acX, acY, acW, acH);
              // ルーバー
              ctx.beginPath();
              for (var lv = 1; lv < 4; lv++) {
                ctx.moveTo(acX + 2, acY + (acH / 4) * lv);
                ctx.lineTo(acX + acW - 2, acY + (acH / 4) * lv);
              }
              ctx.stroke();
            }
          }
          if (lit) ctx.restore();
        }
      }
    }

    // 縦の配管（外壁配管）— 端に1〜2本
    ctx.strokeStyle = night ? "#2a2e34" : "#6f6a60";
    ctx.lineWidth = Math.max(2, w * 0.014);
    var pipeX = w * 0.04;
    ctx.beginPath();
    ctx.moveTo(pipeX, 0);
    ctx.lineTo(pipeX, h);
    ctx.stroke();
    // 配管の継手
    ctx.fillStyle = night ? "#23272c" : "#5e594f";
    for (var py2 = floorH * 0.5; py2 < h; py2 += floorH) {
      ctx.fillRect(pipeX - w * 0.02, py2, w * 0.04, h * 0.012);
    }

    // 全体の汚し
    _grain(ctx, 0, 0, w, h, 0.6, true);

    return _finalize(p.canvas, { clamp: true, srgb: true, aniso: 4 });
  }

  // ===========================================================================
  // 3) tower — 通天閣の各パーツ面（鉄骨トラス / 展望台帯 / 頂部リング / 広告塔）
  // ===========================================================================
  /**
   * @param {string} part "truss"|"deck"|"ring"|"ad"
   * @param {object} [opt] { night:true }
   */
  function tower(part, opt) {
    opt = opt || {};
    var night = opt.night !== false; // 既定 夜
    var w = 256;
    var h = 256;
    var p = _canvas(w, h);
    var ctx = p.ctx;

    if (part === "truss") {
      // 鉄骨トラス（赤錆色の格子）。透けないが格子模様で鉄塔感を出す。
      ctx.fillStyle = night ? "#3a1d12" : "#7a3a22";
      ctx.fillRect(0, 0, w, h);
      // 縦リブ
      var ribN = 4;
      ctx.strokeStyle = night ? "#9a4a2a" : "#b5613a";
      ctx.lineWidth = 10;
      for (var i = 0; i <= ribN; i++) {
        var x = (w / ribN) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // 斜めトラス（×）
      ctx.lineWidth = 6;
      ctx.strokeStyle = night ? "#7a3a22" : "#9c5030";
      var cell = w / ribN;
      for (var cx = 0; cx < w; cx += cell) {
        for (var cy = 0; cy < h; cy += cell) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + cell, cy + cell);
          ctx.moveTo(cx + cell, cy);
          ctx.lineTo(cx, cy + cell);
          ctx.stroke();
        }
      }
      // 横帯（フランジ）
      ctx.lineWidth = 5;
      ctx.strokeStyle = night ? "#8a4327" : "#a85a36";
      for (var hy = 0; hy <= h; hy += cell) {
        ctx.beginPath();
        ctx.moveTo(0, hy);
        ctx.lineTo(w, hy);
        ctx.stroke();
      }
      // リベットの点
      ctx.fillStyle = _rgba("#2a140c", 0.8);
      for (var r = 0; r < 60; r++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // 夜は縦ラインがほんのり発光して見えるよう明色を足す
      if (night) {
        ctx.strokeStyle = _rgba("#ffcaa0", 0.25);
        ctx.lineWidth = 3;
        for (var j = 1; j < ribN; j++) {
          var xx2 = (w / ribN) * j;
          ctx.beginPath();
          ctx.moveTo(xx2, 0);
          ctx.lineTo(xx2, h);
          ctx.stroke();
        }
      }
      _grain(ctx, 0, 0, w, h, 0.5, true);
      return _finalize(p.canvas, { repeat: [1, 4], srgb: true, aniso: 4 });
    }

    if (part === "deck") {
      // 展望台の帯（ぐるり一周の電飾ライン）。emissiveMap 兼用なので黒地＋明線。
      ctx.fillStyle = "#0a0604";
      ctx.fillRect(0, 0, w, h);
      // 中央に太い暖色帯
      var bandY = h * 0.32;
      var bandH = h * 0.36;
      var bg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      bg.addColorStop(0, night ? "#ffdf8a" : "#caa45a");
      bg.addColorStop(0.5, night ? "#ffb347" : "#b07a2e");
      bg.addColorStop(1, night ? "#ff7a2a" : "#8a5a22");
      ctx.fillStyle = bg;
      ctx.fillRect(0, bandY, w, bandH);
      // 帯の上下に電球の点列
      var bulbY1 = bandY - h * 0.04;
      var bulbY2 = bandY + bandH + h * 0.04;
      ctx.fillStyle = night ? "#fff2c0" : "#d8c089";
      for (var bx = w * 0.04; bx < w; bx += w * 0.08) {
        ctx.beginPath();
        ctx.arc(bx, bulbY1, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, bulbY2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // 縦の桟（手すり支柱）
      ctx.strokeStyle = _rgba("#3a2410", 0.7);
      ctx.lineWidth = 3;
      for (var sx = 0; sx < w; sx += w * 0.06) {
        ctx.beginPath();
        ctx.moveTo(sx, bandY);
        ctx.lineTo(sx, bandY + bandH);
        ctx.stroke();
      }
      return _finalize(p.canvas, { repeat: [4, 1], srgb: true, aniso: 4 });
    }

    if (part === "ring") {
      // 頂部リング模様（同心の発光リング）。広告塔まわりに巻く。
      ctx.fillStyle = "#080503";
      ctx.fillRect(0, 0, w, h);
      // 横方向に走る複数の発光帯（円柱に巻くと水平リングになる）
      var rings = [
        { y: 0.2, col: "#ff3b6e" },
        { y: 0.4, col: "#ffd24a" },
        { y: 0.6, col: "#3ad0ff" },
        { y: 0.8, col: "#7CFF6B" },
      ];
      for (var ri = 0; ri < rings.length; ri++) {
        var ry = rings[ri].y * h;
        var col = rings[ri].col;
        var rh = h * 0.07;
        ctx.fillStyle = night ? col : _shade(col, -0.4);
        ctx.fillRect(0, ry - rh / 2, w, rh);
        // 上下のにじみ
        if (night) {
          var gg = ctx.createLinearGradient(0, ry - rh * 1.6, 0, ry + rh * 1.6);
          gg.addColorStop(0, _rgba(col, 0));
          gg.addColorStop(0.5, _rgba(col, 0.5));
          gg.addColorStop(1, _rgba(col, 0));
          ctx.fillStyle = gg;
          ctx.fillRect(0, ry - rh * 1.6, w, rh * 3.2);
        }
      }
      return _finalize(p.canvas, { repeat: [2, 1], srgb: true, aniso: 4 });
    }

    // part === "ad" : 頂部の広告塔の発光面（丸い塔に巻く縦長の発光パネル）
    // 実在企業名は使わず、抽象的な発光ストライプ＋★マークで「広告塔」を表現。
    ctx.fillStyle = "#0a0608";
    ctx.fillRect(0, 0, w, h);
    // 縦の極彩ストライプ
    var cols = ["#ff2d6f", "#ffd24a", "#19d3ff", "#ff7a2a", "#8a5cff"];
    var sw = w / cols.length;
    for (var ci = 0; ci < cols.length; ci++) {
      ctx.fillStyle = night ? cols[ci] : _shade(cols[ci], -0.45);
      ctx.fillRect(ci * sw, 0, sw + 1, h);
    }
    // 中央に白い帯＋★（抽象シンボル）
    ctx.fillStyle = night ? _rgba("#ffffff", 0.92) : _rgba("#cfd3d8", 0.8);
    ctx.fillRect(0, h * 0.38, w, h * 0.24);
    ctx.fillStyle = night ? "#ff3b6e" : "#9a2a45";
    _drawStar(ctx, w / 2, h / 2, 5, w * 0.12, w * 0.05);
    if (night) {
      // 全体にうっすら発光
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = _rgba("#ffffff", 0.06);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    return _finalize(p.canvas, { repeat: [3, 1], srgb: true, aniso: 4 });
  }

  // 星形を塗る（広告塔・ビリケンの装飾用）
  function _drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    var rot = (Math.PI / 2) * 3;
    var step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (var i = 0; i < spikes; i++) {
      var x = cx + Math.cos(rot) * outerR;
      var y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
    ctx.fill();
  }

  // ===========================================================================
  // 4) lantern — 赤提灯の側面（赤地＋白丸＋墨文字＋上下黒帯＋骨の縦線）
  // ===========================================================================
  /**
   * @param {string} [text="酒"]  "串"|"酒"|"ふぐ"など
   * 円柱側面に巻く（横方向は一周＝Clamp、縦も Clamp）。
   */
  function lantern(text) {
    var t = text || "酒";
    var w = 256;
    var h = 256;
    var p = _canvas(w, h);
    var ctx = p.ctx;

    // 赤地（中央が明るい＝提灯内の灯り）
    var rg = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.7);
    rg.addColorStop(0, "#ff5a3c");
    rg.addColorStop(0.5, "#e21f1f");
    rg.addColorStop(1, "#b01616");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);

    // 上下の黒帯（提灯の口輪）
    var capH = h * 0.13;
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(0, 0, w, capH);
    ctx.fillRect(0, h - capH, w, capH);

    // 骨の縦線（提灯のリブ＝横方向に等間隔の縦線）
    ctx.strokeStyle = _rgba("#7a0f0f", 0.55);
    ctx.lineWidth = 3;
    for (var i = 0; i <= 10; i++) {
      var x = (w / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, capH);
      ctx.lineTo(x, h - capH);
      ctx.stroke();
    }
    // 横方向のたわみ線（骨のふくらみ）
    ctx.strokeStyle = _rgba("#7a0f0f", 0.3);
    ctx.lineWidth = 2;
    for (var hy = capH; hy < h - capH; hy += (h - capH * 2) / 6) {
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(w, hy);
      ctx.stroke();
    }

    // 中央の白い円（文字の地）
    ctx.beginPath();
    ctx.fillStyle = _rgba("#fff4e6", 0.95);
    ctx.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 墨文字（縦書き対応：1文字なら大きく、複数なら縦に並べる）
    var chars = Array.from(t);
    var inkOpt = {
      fill: "#1a120c",
      stroke: null,
    };
    if (chars.length === 1) {
      inkOpt.font = "900 " + Math.round(h * 0.34) + "px system-ui";
      _outlinedText(ctx, t, w / 2, h / 2 + h * 0.01, inkOpt);
    } else {
      var lineH = (h * 0.5) / chars.length;
      var fpx = Math.round(lineH * 0.9);
      inkOpt.font = "900 " + fpx + "px system-ui";
      _verticalText(ctx, t, w / 2, h / 2 - (lineH * chars.length) / 2, lineH, inkOpt);
    }

    // 提灯の照り（左上のハイライト）
    var hl = ctx.createRadialGradient(w * 0.36, h * 0.32, 2, w * 0.36, h * 0.32, h * 0.4);
    hl.addColorStop(0, _rgba("#ffffff", 0.28));
    hl.addColorStop(1, _rgba("#ffffff", 0));
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, w, h);

    return _finalize(p.canvas, { clamp: true, srgb: true, aniso: 4 });
  }

  // ===========================================================================
  // 5) noren — 暖簾（地色＋白抜き文字、下端にスリット）
  // ===========================================================================
  /**
   * @param {string} text  "串カツ"等
   * @param {string} [bg="#1b3a5c"]  紺など
   */
  function noren(text, bg) {
    var t = text || "のれん";
    bg = bg || "#1b3a5c";
    var w = 256;
    var h = 192;
    var p = _canvas(w, h);
    var ctx = p.ctx;

    // 透明背景（布の外は抜く＝平面に貼っても余白が出ないよう全面塗り）
    ctx.clearRect(0, 0, w, h);

    // 布本体（やや布目の濃淡）
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, _shade(bg, 0.1));
    g.addColorStop(1, _shade(bg, -0.12));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 布目（縦の薄いストライプ）
    ctx.strokeStyle = _rgba("#000000", 0.07);
    ctx.lineWidth = 1;
    for (var sx = 0; sx < w; sx += 6) {
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }

    // 上端の縫い目（竿通し）
    ctx.fillStyle = _rgba("#000000", 0.18);
    ctx.fillRect(0, 0, w, h * 0.06);

    // 白抜き文字（横1行、長ければ縮小）
    var innerW = w * 0.86;
    var fpx = _fitFontPx(ctx, t, innerW, Math.round(h * 0.5), "900");
    _outlinedText(ctx, t, w / 2, h * 0.42, {
      font: "900 " + fpx + "px system-ui",
      fill: "#f7f3ea",
      stroke: _rgba("#000000", 0.25),
      lineWidth: Math.max(3, fpx * 0.06),
    });

    // 下端スリット（暖簾の割れ目）— 透明で切る
    var slits = 4;
    var slitW = w * 0.02;
    var slitTop = h * 0.62;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    for (var i = 1; i < slits; i++) {
      var x = (w / slits) * i - slitW / 2;
      ctx.fillRect(x, slitTop, slitW, h - slitTop);
    }
    // 下端をギザつかせずまっすぐ切る（布の裾）
    ctx.restore();

    // 裾の影
    ctx.fillStyle = _rgba("#000000", 0.12);
    ctx.fillRect(0, h - h * 0.05, w, h * 0.05);

    // 暖簾は透過を持つので、貼る面の透明部分を活かすため mipmap でにじまないよう clamp。
    return _finalize(p.canvas, { clamp: true, srgb: true, aniso: 4 });
  }

  // ===========================================================================
  // 6) road — 道路/アーケード床（アスファルト＋センター帯＋マンホール＋汚し）
  // ===========================================================================
  /**
   * @param {object} [opt] { night:true }
   * Repeat 前提（縦に長い通り）。
   */
  function road(opt) {
    opt = opt || {};
    var night = opt.night !== false;
    var w = 256;
    var h = 256;
    var p = _canvas(w, h);
    var ctx = p.ctx;

    // アスファルト地
    ctx.fillStyle = night ? "#1b1d22" : "#43464d";
    ctx.fillRect(0, 0, w, h);

    // 骨材（小石）のまだら
    for (var i = 0; i < 1400; i++) {
      var a = Math.random() * 0.10;
      var v = Math.random();
      ctx.fillStyle =
        v < 0.5
          ? "rgba(0,0,0," + a + ")"
          : "rgba(255,255,255," + a * (night ? 0.5 : 0.8) + ")";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }

    // センターの破線（縦に走る＝通りはZ方向）。タイル境界でつながるよう上下端まで。
    var cx = w / 2;
    ctx.fillStyle = night ? "#c9b85a" : "#e8d36a"; // 黄色センターライン
    var dashH = h * 0.18;
    var gap = h * 0.12;
    for (var dy = -gap; dy < h + dashH; dy += dashH + gap) {
      ctx.fillRect(cx - w * 0.018, dy, w * 0.036, dashH);
    }

    // 両端の白線（路側帯）
    ctx.fillStyle = night ? "#9aa0a6" : "#d8dde2";
    ctx.fillRect(w * 0.1, 0, w * 0.012, h);
    ctx.fillRect(w * 0.888, 0, w * 0.012, h);

    // マンホール（タイルに1つ。繰り返しでもうるさくならない位置）
    var mhx = w * 0.3;
    var mhy = h * 0.32;
    var mhr = w * 0.075;
    ctx.beginPath();
    ctx.fillStyle = night ? "#26282d" : "#54575d";
    ctx.arc(mhx, mhy, mhr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = _rgba("#000", 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
    // マンホールの格子模様
    ctx.strokeStyle = _rgba(night ? "#3a3d43" : "#6a6d73", 0.9);
    ctx.lineWidth = 1.5;
    for (var mg = -mhr; mg <= mhr; mg += mhr / 3) {
      ctx.beginPath();
      ctx.moveTo(mhx + mg, mhy - Math.sqrt(Math.max(0, mhr * mhr - mg * mg)));
      ctx.lineTo(mhx + mg, mhy + Math.sqrt(Math.max(0, mhr * mhr - mg * mg)));
      ctx.stroke();
    }

    // 汚れ・轍（中央寄りに薄い縦の擦れ）
    ctx.fillStyle = _rgba("#000000", night ? 0.12 : 0.08);
    ctx.fillRect(w * 0.34, 0, w * 0.06, h);
    ctx.fillRect(w * 0.6, 0, w * 0.06, h);

    // ひび割れ
    ctx.strokeStyle = _rgba("#000000", 0.25);
    ctx.lineWidth = 1;
    for (var ck = 0; ck < 5; ck++) {
      ctx.beginPath();
      var x0 = Math.random() * w;
      var y0 = Math.random() * h;
      ctx.moveTo(x0, y0);
      for (var seg = 0; seg < 4; seg++) {
        x0 += (Math.random() - 0.5) * 40;
        y0 += Math.random() * 30;
        ctx.lineTo(x0, y0);
      }
      ctx.stroke();
    }

    // 縦方向に長く繰り返す（通りの長さに合わせて side で repeat.set 上書き可）
    return _finalize(p.canvas, { repeat: [1, 6], srgb: true, aniso: 8 });
  }

  // ===========================================================================
  // 7) neon — ネオン管文字（黒背景＋発光色アウトライン文字。emissiveMap 用途）
  // ===========================================================================
  /**
   * @param {string} text
   * @param {string} [color="#ff2d6f"]  ネオン色
   * @param {object} [opt] { w:256, h:128 }
   * 黒背景＋発光文字（emissiveMap として使う）。発光はチューブ風の二重ストロークで。
   */
  function neon(text, color, opt) {
    opt = opt || {};
    color = color || "#ff2d6f";
    var w = opt.w || 256;
    var h = opt.h || 128;
    var t = text || "ネオン";
    var p = _canvas(w, h);
    var ctx = p.ctx;

    // emissiveMap なので背景は完全な黒（光らない）
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    var innerW = w * 0.86;
    var fpx = _fitFontPx(ctx, t, innerW, Math.round(h * 0.6), "bold");

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold " + fpx + "px system-ui";

    var cx = w / 2;
    var cy = h / 2;

    // 1) 外側のグロー（太く・ぼかして・発光色）— additive ではなく shadow で
    ctx.save();
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = fpx * 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, fpx * 0.1);
    ctx.strokeText(t, cx, cy);
    ctx.strokeText(t, cx, cy); // 2度描いてグローを濃く
    ctx.restore();

    // 2) 管の本体（発光色の中太線）
    ctx.save();
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = fpx * 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, fpx * 0.06);
    ctx.strokeText(t, cx, cy);
    ctx.restore();

    // 3) 管の芯（白に近い＝ガラス管の中心の高輝度）
    ctx.save();
    ctx.fillStyle = _shade(color, 0.7); // ほぼ白寄り
    ctx.shadowColor = color;
    ctx.shadowBlur = fpx * 0.12;
    // 芯は細い線で
    ctx.strokeStyle = _shade(color, 0.75);
    ctx.lineWidth = Math.max(1, fpx * 0.02);
    ctx.strokeText(t, cx, cy);
    ctx.restore();

    // emissiveMap だが「色を足す」ので sRGB 付与
    return _finalize(p.canvas, { clamp: true, srgb: true, aniso: 4 });
  }

  // ===========================================================================
  // 8) billiken — ビリケンさんの顔/前面（笑顔・尖り頭・足裏）
  // ===========================================================================
  /**
   * @param {object} [opt] {}
   * 看板やレリーフ用の前面テクスチャ。金色っぽい肌＋にっこり笑顔＋尖り頭。
   */
  function billiken(opt) {
    opt = opt || {};
    var w = 256;
    var h = 320;
    var p = _canvas(w, h);
    var ctx = p.ctx;

    // 背景（淡い後光）
    var bgGrad = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.1, w / 2, h * 0.42, h * 0.6);
    bgGrad.addColorStop(0, "#3a2f12");
    bgGrad.addColorStop(1, "#181308");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    var cx = w / 2;
    var skin = "#d9b34a"; // 金色っぽい肌
    var skinHi = _shade(skin, 0.25);
    var skinSh = _shade(skin, -0.3);

    // 体（座った丸い体）
    function bodyGrad(x, y, r) {
      var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, skinHi);
      g.addColorStop(0.6, skin);
      g.addColorStop(1, skinSh);
      return g;
    }

    // 胴
    var bodyY = h * 0.66;
    var bodyR = w * 0.32;
    ctx.fillStyle = bodyGrad(cx, bodyY, bodyR);
    ctx.beginPath();
    ctx.ellipse(cx, bodyY, bodyR, bodyR * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // 足（前に投げ出した足裏が見える）
    var footR = w * 0.12;
    var footY = h * 0.86;
    [-1, 1].forEach(function (s) {
      var fx = cx + s * w * 0.16;
      ctx.fillStyle = bodyGrad(fx, footY, footR);
      ctx.beginPath();
      ctx.ellipse(fx, footY, footR, footR * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // 足裏（撫でるとご利益）— 明るい面＋指
      ctx.fillStyle = skinHi;
      ctx.beginPath();
      ctx.ellipse(fx, footY + footR * 0.2, footR * 0.7, footR * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skinSh;
      for (var ti = 0; ti < 3; ti++) {
        ctx.beginPath();
        ctx.arc(fx - footR * 0.4 + ti * footR * 0.4, footY + footR * 0.55, footR * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 腕（体の脇にちょこんと）
    [-1, 1].forEach(function (s) {
      ctx.fillStyle = bodyGrad(cx + s * bodyR * 0.95, bodyY + bodyR * 0.1, w * 0.1);
      ctx.beginPath();
      ctx.ellipse(cx + s * bodyR * 0.95, bodyY + bodyR * 0.1, w * 0.09, w * 0.13, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 頭（尖り頭）
    var headY = h * 0.34;
    var headR = w * 0.27;
    ctx.fillStyle = bodyGrad(cx, headY, headR);
    ctx.beginPath();
    // 下は丸く、上に尖る輪郭
    ctx.moveTo(cx - headR, headY + headR * 0.2);
    ctx.quadraticCurveTo(cx - headR, headY - headR * 0.7, cx - headR * 0.25, headY - headR * 1.0);
    ctx.quadraticCurveTo(cx, headY - headR * 1.5, cx + headR * 0.25, headY - headR * 1.0); // てっぺん尖り
    ctx.quadraticCurveTo(cx + headR, headY - headR * 0.7, cx + headR, headY + headR * 0.2);
    ctx.quadraticCurveTo(cx + headR, headY + headR * 1.0, cx, headY + headR * 1.0);
    ctx.quadraticCurveTo(cx - headR, headY + headR * 1.0, cx - headR, headY + headR * 0.2);
    ctx.closePath();
    ctx.fill();

    // つり上がった細い目（にっこり）
    ctx.strokeStyle = "#2a1d08";
    ctx.lineWidth = w * 0.018;
    ctx.lineCap = "round";
    [-1, 1].forEach(function (s) {
      var ex = cx + s * headR * 0.4;
      var ey = headY - headR * 0.05;
      ctx.beginPath();
      // 三日月型の細い目（外側上がり）
      ctx.moveTo(ex - s * headR * 0.18, ey + headR * 0.04);
      ctx.quadraticCurveTo(ex, ey - headR * 0.12, ex + s * headR * 0.18, ey - headR * 0.02);
      ctx.stroke();
    });

    // 眉
    ctx.lineWidth = w * 0.012;
    [-1, 1].forEach(function (s) {
      var ex = cx + s * headR * 0.42;
      var ey = headY - headR * 0.28;
      ctx.beginPath();
      ctx.moveTo(ex - s * headR * 0.16, ey + headR * 0.05);
      ctx.quadraticCurveTo(ex, ey - headR * 0.04, ex + s * headR * 0.16, ey - headR * 0.06);
      ctx.stroke();
    });

    // 鼻
    ctx.fillStyle = skinSh;
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.2, headR * 0.1, headR * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();

    // 口（にっこり笑顔の弧）
    ctx.strokeStyle = "#2a1d08";
    ctx.lineWidth = w * 0.02;
    ctx.beginPath();
    ctx.arc(cx, headY + headR * 0.28, headR * 0.42, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();

    // 頬（ほんのり赤み）
    ctx.fillStyle = _rgba("#e07a3a", 0.3);
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.ellipse(cx + s * headR * 0.55, headY + headR * 0.3, headR * 0.16, headR * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 全体ハイライト（金属光沢っぽく）
    var gloss = ctx.createLinearGradient(0, 0, w, 0);
    gloss.addColorStop(0, _rgba("#ffffff", 0));
    gloss.addColorStop(0.35, _rgba("#fff7d8", 0.12));
    gloss.addColorStop(0.5, _rgba("#ffffff", 0));
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, w, h);

    return _finalize(p.canvas, { clamp: true, srgb: true, aniso: 4 });
  }

  // ===========================================================================
  // 9) sky — 空（scene.background 用の大きなグラデ。夜=濃紺＋星、昼=水色＋雲）
  // ===========================================================================
  /**
   * @param {boolean} night
   */
  function sky(night) {
    var w = 1024;
    var h = 1024;
    var p = _canvas(w, h);
    var ctx = p.ctx;

    if (night) {
      // 夜空：上は濃紺、下（地平）はやや赤紫（街明かりの照り返し）
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.0, "#05070f");
      g.addColorStop(0.45, "#0a0e1a");
      g.addColorStop(0.78, "#141426");
      g.addColorStop(0.92, "#3a2438"); // 地平の街明かり（赤紫）
      g.addColorStop(1.0, "#5a2f33");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 星（上半分に多め、下は少なめ）
      for (var i = 0; i < 900; i++) {
        var sx = Math.random() * w;
        var sy = Math.random() * h * 0.82;
        // 下に行くほど星を減らす
        if (Math.random() < sy / h) continue;
        var r = Math.random() < 0.92 ? Math.random() * 1.2 + 0.3 : Math.random() * 2.2 + 1;
        var br = 0.4 + Math.random() * 0.6;
        // 星の色（白〜淡黄〜淡青）
        var tint = Math.random();
        var col =
          tint < 0.7
            ? "rgba(255,255,255," + br + ")"
            : tint < 0.85
            ? "rgba(255,240,200," + br + ")"
            : "rgba(200,225,255," + br + ")";
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        // 明るい星はにじみ
        if (r > 1.5) {
          ctx.fillStyle = "rgba(255,255,255," + br * 0.25 + ")";
          ctx.beginPath();
          ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 月（淡くにじむ）
      var mx = w * 0.78;
      var my = h * 0.2;
      var mr = w * 0.05;
      var mg = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 2.4);
      mg.addColorStop(0, "rgba(255,250,230,0.95)");
      mg.addColorStop(0.4, "rgba(255,248,225,0.5)");
      mg.addColorStop(1, "rgba(255,248,225,0)");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,252,238,1)";
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();

      // 地平近くの街明かりのにじみ（横に伸びる暖色光）
      var hg = ctx.createLinearGradient(0, h * 0.86, 0, h);
      hg.addColorStop(0, "rgba(255,140,80,0)");
      hg.addColorStop(1, "rgba(255,150,90,0.25)");
      ctx.fillStyle = hg;
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
    } else {
      // 昼空：上は青、下は白っぽく（霞）
      var g2 = ctx.createLinearGradient(0, 0, 0, h);
      g2.addColorStop(0.0, "#3f7fc4");
      g2.addColorStop(0.45, "#7fb0dd");
      g2.addColorStop(0.8, "#bcd3e8");
      g2.addColorStop(1.0, "#e6eef4");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // 太陽（淡い光芒）
      var sxn = w * 0.74;
      var syn = h * 0.22;
      var sgr = ctx.createRadialGradient(sxn, syn, 4, sxn, syn, w * 0.18);
      sgr.addColorStop(0, "rgba(255,255,250,0.95)");
      sgr.addColorStop(0.3, "rgba(255,252,235,0.5)");
      sgr.addColorStop(1, "rgba(255,252,235,0)");
      ctx.fillStyle = sgr;
      ctx.beginPath();
      ctx.arc(sxn, syn, w * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // ふわっとした雲（複数の白い円を重ねる）
      function cloud(cx, cy, scale) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        var lobes = [
          [0, 0, 1.0],
          [-1.1, 0.15, 0.8],
          [1.1, 0.12, 0.85],
          [-0.55, -0.5, 0.7],
          [0.6, -0.45, 0.75],
          [-1.8, 0.25, 0.55],
          [1.7, 0.22, 0.6],
        ];
        var r0 = 40 * scale;
        // 下を平らに見せる影
        ctx.fillStyle = "rgba(225,232,240,0.85)";
        for (var li = 0; li < lobes.length; li++) {
          ctx.beginPath();
          ctx.arc(cx + lobes[li][0] * r0, cy + lobes[li][1] * r0 + r0 * 0.2, r0 * lobes[li][2], 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        for (var li2 = 0; li2 < lobes.length; li2++) {
          ctx.beginPath();
          ctx.arc(cx + lobes[li2][0] * r0, cy + lobes[li2][1] * r0, r0 * lobes[li2][2], 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      cloud(w * 0.22, h * 0.3, 1.3);
      cloud(w * 0.55, h * 0.5, 1.0);
      cloud(w * 0.82, h * 0.62, 1.5);
      cloud(w * 0.38, h * 0.66, 0.9);
      cloud(w * 0.12, h * 0.55, 1.1);
    }

    // 背景球/背景画像として使う。横一周するので横は Repeat、縦は Clamp。
    var tex = _finalize(p.canvas, { srgb: true });
    tex.wrapS = THREE.RepeatWrapping; // 横方向は継ぎ目を許容（球/箱どちらでも破綻しにくい）
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  // ===========================================================================
  // 10) meibutsu — 立体看板の面（名物アイコン: ふぐ/たこ/かに/串カツ/ぎょうざ）
  // ===========================================================================
  /**
   * @param {string} motif "fugu"|"tako"|"kani"|"kushikatsu"|"gyoza"
   * @param {object} [opt] {}
   */
  function meibutsu(motif, opt) {
    opt = opt || {};
    var w = 256;
    var h = 256;
    var p = _canvas(w, h);
    var ctx = p.ctx;
    var cx = w / 2;
    var cy = h / 2;

    // 背景（看板の地：明るいクリーム＋丸枠）
    ctx.fillStyle = "#fff3d6";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c01a1a";
    ctx.lineWidth = w * 0.05;
    _roundRect(ctx, w * 0.06, h * 0.06, w * 0.88, h * 0.88, w * 0.1);
    ctx.stroke();

    if (motif === "fugu") {
      // ふぐ：膨らんだ体＋トゲ＋ヒレ＋とぼけ顔
      var bodyR = w * 0.3;
      var grad = ctx.createRadialGradient(cx - bodyR * 0.3, cy - bodyR * 0.3, bodyR * 0.1, cx, cy, bodyR);
      grad.addColorStop(0, "#fff4e0");
      grad.addColorStop(0.6, "#e8c98c");
      grad.addColorStop(1, "#b88a3a");
      // トゲ
      ctx.fillStyle = "#caa05a";
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        var sx = cx + Math.cos(a) * bodyR * 1.0;
        var sy = cy + Math.sin(a) * bodyR * 1.0;
        var tx = cx + Math.cos(a) * bodyR * 1.22;
        var ty = cy + Math.sin(a) * bodyR * 1.22;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a + 0.18) * 6, sy + Math.sin(a + 0.18) * 6);
        ctx.lineTo(tx, ty);
        ctx.lineTo(sx + Math.cos(a - 0.18) * 6, sy + Math.sin(a - 0.18) * 6);
        ctx.closePath();
        ctx.fill();
      }
      // 尾ヒレ
      ctx.fillStyle = "#caa05a";
      ctx.beginPath();
      ctx.moveTo(cx + bodyR * 0.9, cy);
      ctx.lineTo(cx + bodyR * 1.5, cy - bodyR * 0.4);
      ctx.lineTo(cx + bodyR * 1.5, cy + bodyR * 0.4);
      ctx.closePath();
      ctx.fill();
      // 体
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
      ctx.fill();
      // 白い腹
      ctx.fillStyle = _rgba("#fffaf0", 0.85);
      ctx.beginPath();
      ctx.ellipse(cx - bodyR * 0.1, cy + bodyR * 0.35, bodyR * 0.7, bodyR * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      // 目
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx - bodyR * 0.3, cy - bodyR * 0.25, bodyR * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a140c";
      ctx.beginPath();
      ctx.arc(cx - bodyR * 0.26, cy - bodyR * 0.23, bodyR * 0.08, 0, Math.PI * 2);
      ctx.fill();
      // 口（とぼけた口）
      ctx.strokeStyle = "#7a3a22";
      ctx.lineWidth = w * 0.02;
      ctx.beginPath();
      ctx.arc(cx - bodyR * 0.15, cy + bodyR * 0.1, bodyR * 0.18, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else if (motif === "tako") {
      // たこ：赤い頭＋目＋足（吸盤）
      var hr = w * 0.22;
      var ty0 = cy - h * 0.06;
      var tg = ctx.createRadialGradient(cx - hr * 0.3, ty0 - hr * 0.3, hr * 0.1, cx, ty0, hr * 1.3);
      tg.addColorStop(0, "#ff7a6a");
      tg.addColorStop(0.6, "#e23b2a");
      tg.addColorStop(1, "#a82218");
      // 足（8本うねうね）
      ctx.fillStyle = "#e23b2a";
      for (var li = 0; li < 6; li++) {
        var ang = Math.PI * (0.15 + (li / 5) * 0.7);
        var lx = cx - Math.cos(ang) * hr * 0.9;
        var endx = cx - Math.cos(ang) * hr * 2.6 + (Math.random() - 0.5) * 20;
        var endy = ty0 + Math.sin(ang) * hr * 2.8;
        ctx.beginPath();
        ctx.moveTo(lx, ty0 + hr * 0.6);
        ctx.quadraticCurveTo(lx + (endx - lx) * 0.5, ty0 + hr * 1.6, endx, endy);
        ctx.lineWidth = hr * 0.4;
        ctx.strokeStyle = "#e23b2a";
        ctx.lineCap = "round";
        ctx.stroke();
      }
      // 頭
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.ellipse(cx, ty0, hr, hr * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // 目
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(cx + s * hr * 0.4, ty0 - hr * 0.1, hr * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a140c";
        ctx.beginPath();
        ctx.arc(cx + s * hr * 0.42, ty0 - hr * 0.08, hr * 0.1, 0, Math.PI * 2);
        ctx.fill();
      });
      // 口
      ctx.strokeStyle = "#7a1810";
      ctx.lineWidth = w * 0.016;
      ctx.beginPath();
      ctx.arc(cx, ty0 + hr * 0.3, hr * 0.2, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (motif === "kani") {
      // かに：甲羅＋ハサミ＋脚
      var cr = w * 0.26;
      var cyy = cy - h * 0.02;
      ctx.fillStyle = "#e8492e";
      // 脚（左右4本ずつ）
      ctx.strokeStyle = "#e8492e";
      ctx.lineWidth = w * 0.03;
      ctx.lineCap = "round";
      for (var leg = 0; leg < 3; leg++) {
        [-1, 1].forEach(function (s) {
          var ly = cyy - cr * 0.2 + leg * cr * 0.4;
          ctx.beginPath();
          ctx.moveTo(cx + s * cr * 0.7, ly);
          ctx.quadraticCurveTo(cx + s * cr * 1.6, ly - cr * 0.2, cx + s * cr * 1.9, ly + cr * 0.3);
          ctx.stroke();
        });
      }
      // 甲羅
      var kg = ctx.createRadialGradient(cx - cr * 0.3, cyy - cr * 0.3, cr * 0.1, cx, cyy, cr);
      kg.addColorStop(0, "#ff7355");
      kg.addColorStop(0.7, "#e8492e");
      kg.addColorStop(1, "#b22f1c");
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.ellipse(cx, cyy, cr, cr * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      // ハサミ（上に2つ）
      [-1, 1].forEach(function (s) {
        var hx = cx + s * cr * 0.9;
        var hy = cyy - cr * 0.7;
        ctx.fillStyle = "#e8492e";
        ctx.beginPath();
        ctx.ellipse(hx, hy, cr * 0.34, cr * 0.24, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // ハサミの割れ
        ctx.strokeStyle = "#fff3d6";
        ctx.lineWidth = w * 0.012;
        ctx.beginPath();
        ctx.moveTo(hx - s * cr * 0.3, hy);
        ctx.lineTo(hx + s * cr * 0.3, hy - cr * 0.12);
        ctx.stroke();
      });
      // 目
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(cx + s * cr * 0.3, cyy - cr * 0.35, cr * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a140c";
        ctx.beginPath();
        ctx.arc(cx + s * cr * 0.3, cyy - cr * 0.35, cr * 0.07, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (motif === "gyoza") {
      // ぎょうざ：三日月のヒダ＋湯気
      var gx = cx;
      var gy = cy + h * 0.05;
      var gw = w * 0.32;
      var gh = h * 0.18;
      var gg = ctx.createLinearGradient(0, gy - gh, 0, gy + gh);
      gg.addColorStop(0, "#f3e0b0");
      gg.addColorStop(1, "#c89a54");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(gx - gw, gy + gh * 0.4);
      ctx.quadraticCurveTo(gx, gy - gh * 1.4, gx + gw, gy + gh * 0.4);
      ctx.quadraticCurveTo(gx, gy + gh * 1.0, gx - gw, gy + gh * 0.4);
      ctx.closePath();
      ctx.fill();
      // 焼き目
      ctx.fillStyle = _rgba("#8a5a22", 0.5);
      ctx.beginPath();
      ctx.ellipse(gx, gy + gh * 0.5, gw * 0.92, gh * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // ヒダ
      ctx.strokeStyle = "#a8782e";
      ctx.lineWidth = w * 0.012;
      for (var hf = -3; hf <= 3; hf++) {
        ctx.beginPath();
        ctx.moveTo(gx + hf * gw * 0.28, gy - gh * 0.2);
        ctx.lineTo(gx + hf * gw * 0.28 + gw * 0.05, gy - gh * 0.7);
        ctx.stroke();
      }
      // 湯気
      ctx.strokeStyle = _rgba("#ffffff", 0.7);
      ctx.lineWidth = w * 0.02;
      ctx.lineCap = "round";
      [-1, 0, 1].forEach(function (s) {
        ctx.beginPath();
        var bx = gx + s * gw * 0.5;
        ctx.moveTo(bx, gy - gh * 1.2);
        ctx.quadraticCurveTo(bx + 14, gy - gh * 1.8, bx - 8, gy - gh * 2.4);
        ctx.quadraticCurveTo(bx - 20, gy - gh * 3.0, bx + 6, gy - gh * 3.6);
        ctx.stroke();
      });
    } else {
      // kushikatsu（既定）：串に刺さった揚げ物＋ソース
      var sticks = 3;
      var baseY = h * 0.86;
      for (var ki = 0; ki < sticks; ki++) {
        var kx = w * (0.3 + ki * 0.2);
        // 串（棒）
        ctx.strokeStyle = "#caa46a";
        ctx.lineWidth = w * 0.018;
        ctx.beginPath();
        ctx.moveTo(kx, baseY);
        ctx.lineTo(kx, h * 0.28);
        ctx.stroke();
        // 衣（揚げ玉のごつごつ）
        var fy = h * 0.42;
        var fr = w * 0.1;
        var fg = ctx.createRadialGradient(kx - fr * 0.3, fy - fr * 0.3, fr * 0.1, kx, fy, fr);
        fg.addColorStop(0, "#f0c878");
        fg.addColorStop(0.7, "#d99a44");
        fg.addColorStop(1, "#a86a26");
        ctx.fillStyle = fg;
        ctx.beginPath();
        // ごつごつ輪郭
        var pts = 12;
        for (var pi = 0; pi <= pts; pi++) {
          var ang2 = (pi / pts) * Math.PI * 2;
          var rr = fr * (1 + (pi % 2 ? 0.12 : -0.05));
          var ptx = kx + Math.cos(ang2) * rr;
          var pty = fy + Math.sin(ang2) * rr * 1.2;
          if (pi === 0) ctx.moveTo(ptx, pty);
          else ctx.lineTo(ptx, pty);
        }
        ctx.closePath();
        ctx.fill();
        // パン粉の粒
        ctx.fillStyle = _rgba("#fbe2a0", 0.7);
        for (var cr2 = 0; cr2 < 8; cr2++) {
          ctx.beginPath();
          ctx.arc(kx + (Math.random() - 0.5) * fr * 1.4, fy + (Math.random() - 0.5) * fr * 1.6, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // ソースの皿（下に黒いソース）
      ctx.fillStyle = "#3a2410";
      ctx.beginPath();
      ctx.ellipse(cx, baseY + h * 0.02, w * 0.3, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = _rgba("#1a0e06", 0.6);
      ctx.beginPath();
      ctx.ellipse(cx, baseY + h * 0.01, w * 0.26, h * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    return _finalize(p.canvas, { clamp: true, srgb: true, aniso: 4 });
  }

  // ===========================================================================
  // 公開
  // ===========================================================================
  return {
    signboard: signboard,
    wall: wall,
    tower: tower,
    lantern: lantern,
    noren: noren,
    road: road,
    neon: neon,
    billiken: billiken,
    sky: sky,
    meibutsu: meibutsu,
  };
})();

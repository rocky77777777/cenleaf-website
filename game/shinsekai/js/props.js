/* =====================================================================
 * props.js  →  window.Props
 * ミニチュア新世界 — 賑わいの小物（提灯・暖簾・立体看板・ビリケン・街灯・人影）
 *
 * 契約（DESIGN.md §7, §1, §6, §12）に厳密準拠：
 *  - window.Props.build() は全プロップの親 THREE.Group を返す。
 *  - 情報を持つもの（提灯列・立体看板・ビリケン）は City.register + City.scene.add。
 *  - 街灯・人影・暖簾は数が多い/情報なしなので register しない（scene.add のみ）。
 *  - 発光の昼夜切替は各オブジェクトの userData.onNight(flag) フックで行う
 *    （City.setNight が登録オブジェクトに伝播する）。
 *  - PointLight は City.addDecoLight 経由（予算 MAX_POINTLIGHTS=24・超過時 null）。
 *  - 揺れ等のアニメは City.onUpdate((dt,t)=>{}) に登録（rAF は City.start() の1本のみ）。
 *
 * r137 前提：CapsuleGeometry は存在しないので人影は Cylinder＋Sphere で作る。
 * 外部画像/フォント禁止。文字・模様は textures.js（Tex）の CanvasTexture を使う。
 * ===================================================================== */
(function () {
  "use strict";

  // ---- 発光まわりの基準値（昼夜で切替）----
  var EMIT_NIGHT = 1.15; // 夜の emissiveIntensity（提灯・看板の光る面）
  var EMIT_DAY = 0.12; // 昼は弱める（光って見えない方が自然）
  var BULB_NIGHT = 1.4; // 街灯の電球
  var BULB_DAY = 0.0;

  // setNight 時に「全発光メッシュ」を一括で切替えるためのレジストリ。
  // { mesh, night, day } を貯め、各 onNight フックから参照する。
  // ※モジュール内クロージャ。City には漏らさない。
  var glowItems = [];

  /**
   * 発光メッシュを登録。夜/昼の emissiveIntensity を保持しておき、
   * applyNight(flag) でまとめて反映する。
   */
  function trackGlow(mesh, nightV, dayV) {
    glowItems.push({ mesh: mesh, night: nightV, day: dayV });
    // 初期は夜（City.night デフォルト true）。City.night が定義済ならそれに従う。
    var isNight = window.City && typeof City.night === "boolean" ? City.night : true;
    mesh.material.emissiveIntensity = isNight ? nightV : dayV;
  }

  /** 登録済みの発光メッシュ全部に夜/昼を反映 */
  function applyNight(flag) {
    for (var i = 0; i < glowItems.length; i++) {
      var g = glowItems[i];
      if (g.mesh && g.mesh.material) {
        g.mesh.material.emissiveIntensity = flag ? g.night : g.day;
      }
    }
  }

  // ============================================================
  // 1) 赤提灯（あかちょうちん）
  //    - 通りに沿って y≈10 の高さに左右に吊るす（軒先に連なる）。
  //    - Cylinder の上下をすぼめた“提灯シルエット”＋Tex.lantern。
  //    - 夜は赤く発光（emissive）。微妙に揺れる（City.onUpdate）。
  //    - 代表 PointLight を数個だけ（全提灯には付けない）。
  //    - 列はまとめて1つ register（kind:"prop" / name:"赤提灯"）。
  // ============================================================

  /**
   * 1個の赤提灯メッシュ群（紐＋上下黒キャップ＋胴）を作って Group で返す。
   * 胴は中央が太く上下がすぼまった“提灯型”を、半径プロファイルを与えた
   * LatheGeometry…ではなく軽量重視で「太いCylinder＋上下に小さいCone帽子」で表現。
   * 側面に Tex.lantern を巻く。
   */
  function makeLantern(text) {
    var g = new THREE.Group();

    var bodyTex = Tex.lantern(text); // 赤地＋白丸＋墨文字＋黒帯＋骨の縦線
    bodyTex.wrapS = THREE.ClampToEdgeWrapping;
    bodyTex.wrapT = THREE.ClampToEdgeWrapping;

    // 胴（中央が太い樽型に近づけるため open-ended Cylinder を使い、半径は中庸）
    var R = 1.05; // 胴半径
    var H = 1.7; // 胴高さ
    var bodyGeo = new THREE.CylinderGeometry(R * 0.82, R * 0.82, H, 18, 1, true);
    // 中央を膨らませる：頂点を樽型に変形（軽量・1個分だけ）
    barrelize(bodyGeo, R, H);

    var bodyMat = new THREE.MeshStandardMaterial({
      map: bodyTex,
      emissive: 0xff5a22, // 暖色オレンジ赤
      emissiveMap: bodyTex, // 文字・地ごと光らせる（提灯らしさ）
      emissiveIntensity: EMIT_NIGHT,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide, // open-ended なので内側も見えうる
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = false; // 提灯は影を落とさない（負荷・見た目）
    body.receiveShadow = false;
    g.add(body);
    trackGlow(body, EMIT_NIGHT, EMIT_DAY);

    // 上下の黒い口金（小さな円柱）
    var capMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7, metalness: 0.2 });
    var capTop = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.4, R * 0.55, 0.22, 14), capMat);
    capTop.position.y = H / 2 + 0.08;
    g.add(capTop);
    var capBot = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.5, R * 0.34, 0.2, 14), capMat);
    capBot.position.y = -H / 2 - 0.07;
    g.add(capBot);

    // 吊り紐（細い円柱、軒の梁まで）
    var cordMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), cordMat);
    cord.position.y = H / 2 + 0.7;
    g.add(cord);

    // 下のふさ（小さな玉）
    var tassel = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf2c14a, roughness: 0.6 })
    );
    tassel.position.y = -H / 2 - 0.28;
    g.add(tassel);

    return g;
  }

  /** Cylinder の頂点を樽型（中央膨らみ）に変形する軽量ヘルパ */
  function barrelize(geo, maxR, h) {
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var z = pos.getZ(i);
      // y(-h/2..+h/2) を 0..1 に、中央(0.5)で最大膨らみ
      var t = (y + h / 2) / h;
      var bulge = 1.0 + 0.32 * Math.sin(Math.PI * t); // 端1.0 / 中央1.32
      var r = Math.sqrt(x * x + z * z);
      if (r > 1e-4) {
        // 膨らませた半径を最大半径でクランプし、x/z を等倍スケール
        var nr = Math.min(r * bulge, maxR);
        var s = nr / r;
        pos.setX(i, x * s);
        pos.setZ(i, z * s);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /**
   * 赤提灯の列を構築。通りの左右（X≈±8、軒先内側）に Z=+6..-76 を約3unit間隔で吊るす。
   * まとめて1つの Group を作り、City.register（kind:"prop"）して情報も付ける。
   * 揺れ：City.onUpdate で各提灯を僅かに揺らす。
   */
  function buildLanterns(parent) {
    var group = new THREE.Group();
    group.name = "赤提灯の列";

    var texts = ["酒", "串", "ふぐ", "祭", "福", "ホ"]; // 文字バリエーション（実在店名は使わない）
    var sides = [-8.0, 8.0]; // 通り中心X=0、軒先内側に吊るす（街路幅18の縁の少し内）
    var zStart = 6,
      zEnd = -76,
      step = 3.0;
    var y = 10.0;

    var swayList = []; // 揺れ対象 { mesh, phase, ampR, ampX }

    var idx = 0;
    for (var s = 0; s < sides.length; s++) {
      var x = sides[s];
      for (var z = zStart; z >= zEnd; z -= step) {
        var lan = makeLantern(texts[idx % texts.length]);
        lan.position.set(x, y, z);
        group.add(lan);
        swayList.push({
          mesh: lan,
          phase: idx * 0.7, // 個体ごとに位相をずらす
          ampR: 0.06 + (idx % 3) * 0.015, // 揺れ角
          baseY: y,
        });
        idx++;
      }
    }

    // 代表 PointLight（全提灯には付けない＝負荷対策）。列の数カ所だけ暖色で。
    // 仕様 §3.2: 提灯=暖色 0xff5522 int1.2 dist14
    var lightZs = [0, -24, -48, -70];
    for (var li = 0; li < lightZs.length; li++) {
      // 左右の中間（通り上空）に置いて両側の提灯を温める
      City.addDecoLight(0xff5522, 1.2, 14, { x: 0, y: y + 0.5, z: lightZs[li] });
    }

    // 揺れアニメ（軽量：sin で y 微上下＋z軸回りに僅か回転）
    City.onUpdate(function (dt, t) {
      for (var i = 0; i < swayList.length; i++) {
        var it = swayList[i];
        it.mesh.rotation.z = Math.sin(t * 1.1 + it.phase) * it.ampR;
        it.mesh.position.y = it.baseY + Math.sin(t * 1.6 + it.phase) * 0.05;
      }
    });

    // 情報（§12.8 赤提灯）。列全体を1オブジェクトとして登録。
    group.userData.info = {
      name: "赤提灯",
      kind: "prop",
      tag: "赤提灯",
      body:
        "店先にずらりと並ぶ、まっ赤な提灯。\n" +
        "灯りがともると「さあ、一杯どうぞ」の合図。\n" +
        "新世界の夜を主役級に彩る、いちばん下町らしい灯りです。",
    };
    // 夜更新フック（提灯の発光は trackGlow 管理なので applyNight に委譲）
    group.userData.onNight = function (flag) {
      applyNight(flag);
    };

    // register は“情報登録”のみ（cityRoot を子孫まで自動付与＝Raycast→親解決）。
    // scene への実体追加は親Group(root)経由で build() がまとめて行う。
    City.register(group);
    parent.add(group);
    return group;
  }

  // ============================================================
  // 2) 暖簾（のれん）— 店先に吊るす平面（情報なし・register しない）
  //    Tex.noren(text,bg) を貼った薄い板を、軒下の低い位置に。
  // ============================================================
  function buildNorens(parent) {
    var group = new THREE.Group();
    group.name = "暖簾";

    // のれんを出す店先（西列x=-16 / 東列x=+16、通りに面する内側ファサード前）
    // 通りに面する面は西列なら x≈-9.5、東列なら x≈+9.5 あたり（建物前面より少し通り寄り）。
    var specs = [
      { x: -9.4, z: 0, text: "串カツ", bg: "#7a1416" },
      { x: -9.4, z: -28, text: "ふぐ", bg: "#16324f" },
      { x: -9.4, z: -56, text: "酒", bg: "#3a2a16" },
      { x: 9.4, z: -14, text: "ホルモン", bg: "#5a1a10" },
      { x: 9.4, z: -42, text: "うどん", bg: "#1d3a2a" },
      { x: 9.4, z: -70, text: "甘味", bg: "#5a2440" },
    ];

    for (var i = 0; i < specs.length; i++) {
      var sp = specs[i];
      var tex = Tex.noren(sp.text, sp.bg);
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      var mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.95,
        metalness: 0.0,
        transparent: true, // のれんの下端スリットを透過で抜く想定
        side: THREE.DoubleSide,
      });
      // 横長ののれん（幅3.2 × 高さ1.6）。軒下 y≈4.2 に吊るす。
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), mat);
      mesh.position.set(sp.x, 4.2, sp.z);
      // 通りに面する向き：西列は +X 方向（通り側）を向く、東列は -X 方向。
      mesh.rotation.y = sp.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
    }

    parent.add(group);
    return group; // register しない（情報なし）
  }

  // ============================================================
  // 3) 立体看板（名物オブジェ）— ふぐ／たこ／かに／串カツ
  //    軒先・店先に大きな3Dオブジェ。個別 register（kind:"sign"）。
  //    面に Tex.meibutsu(motif) を貼って“それっぽさ”を補強。
  // ============================================================

  /** ふぐ：膨らんだ楕円体＋背/尾ビレ＋目。前面に Tex.meibutsu("fugu")。 */
  function makeFugu() {
    var g = new THREE.Group();
    var tex = Tex.meibutsu("fugu");
    var bodyMat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xf6e6c8,
      roughness: 0.6,
      metalness: 0.05,
      emissive: 0xffe2a0,
      emissiveMap: tex,
      emissiveIntensity: EMIT_NIGHT * 0.7, // 看板はやや控えめに光らせる
    });
    // 膨らんだ胴（球を横に潰して楕円体に）
    var body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 18), bodyMat);
    body.scale.set(1.25, 0.95, 1.0);
    body.castShadow = true;
    g.add(body);
    trackGlow(body, EMIT_NIGHT * 0.7, EMIT_DAY);

    // 目（左右）
    var eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    var eyeB = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var ew = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), eyeW);
      ew.position.set(1.3, 0.4, sgn * 0.55);
      ew.scale.set(0.7, 1, 1);
      g.add(ew);
      var eb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), eyeB);
      eb.position.set(1.5, 0.42, sgn * 0.55);
      g.add(eb);
    }
    // 口（小さなトーラスの一部っぽく、簡易に円柱）
    var mouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xc0463a, roughness: 0.5 })
    );
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(1.62, -0.05, 0);
    g.add(mouth);

    // 尾ビレ（コーンを寝かせる）
    var finMat = new THREE.MeshStandardMaterial({ color: 0xeac98a, roughness: 0.6, side: THREE.DoubleSide });
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.1, 4), finMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-1.7, 0.1, 0);
    g.add(tail);
    // 背ビレ
    var dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 4), finMat);
    dorsal.position.set(-0.2, 1.3, 0);
    g.add(dorsal);

    return g;
  }

  /** たこ：丸い頭＋8本足（細い円柱を放射）。前面に Tex.meibutsu("tako")。 */
  function makeTako() {
    var g = new THREE.Group();
    var tex = Tex.meibutsu("tako");
    var headMat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xd83a3a,
      roughness: 0.55,
      metalness: 0.05,
      emissive: 0xff5a4a,
      emissiveMap: tex,
      emissiveIntensity: EMIT_NIGHT * 0.6,
    });
    var head = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 18), headMat);
    head.scale.set(1, 1.15, 1);
    head.position.y = 0.6;
    head.castShadow = true;
    g.add(head);
    trackGlow(head, EMIT_NIGHT * 0.6, EMIT_DAY);

    // 目
    var eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    var eyeB = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var ew = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), eyeW);
      ew.position.set(sgn * 0.42, 1.0, 1.05);
      g.add(ew);
      var eb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), eyeB);
      eb.position.set(sgn * 0.42, 1.0, 1.22);
      g.add(eb);
    }

    // 8本足（下方に放射状）
    var legMat = new THREE.MeshStandardMaterial({ color: 0xc83232, roughness: 0.6 });
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.5, 8), legMat);
      var r = 0.9;
      leg.position.set(Math.cos(a) * r, -0.45, Math.sin(a) * r);
      leg.rotation.x = Math.sin(a) * 0.5;
      leg.rotation.z = -Math.cos(a) * 0.5;
      g.add(leg);
    }
    return g;
  }

  /** かに：甲羅（潰した球）＋ハサミ＋脚。前面に Tex.meibutsu("kani")。 */
  function makeKani() {
    var g = new THREE.Group();
    var tex = Tex.meibutsu("kani");
    var shellMat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xe2552f,
      roughness: 0.55,
      metalness: 0.08,
      emissive: 0xff6a3a,
      emissiveMap: tex,
      emissiveIntensity: EMIT_NIGHT * 0.6,
    });
    var shell = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), shellMat);
    shell.scale.set(1.5, 0.7, 1.1);
    shell.castShadow = true;
    g.add(shell);
    trackGlow(shell, EMIT_NIGHT * 0.6, EMIT_DAY);

    var legMat = new THREE.MeshStandardMaterial({ color: 0xd24a28, roughness: 0.6 });
    // ハサミ（左右）：太い円柱＋先端の球
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 8), legMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(sgn * 1.9, 0.2, 0.7);
      g.add(arm);
      var claw = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), legMat);
      claw.scale.set(1, 1.3, 0.6);
      claw.position.set(sgn * 2.6, 0.25, 0.7);
      g.add(claw);
    }
    // 歩脚（左右各3本）
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      for (var j = 0; j < 3; j++) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.3, 6), legMat);
        leg.rotation.z = (Math.PI / 2.4) * s2;
        leg.position.set(s2 * 1.5, -0.1, -0.4 - j * 0.5);
        g.add(leg);
      }
    }
    // 目（突起の上に）
    var eyeStalkMat = legMat;
    var eyeB = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });
    for (var sgn3 = -1; sgn3 <= 1; sgn3 += 2) {
      var stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 6), eyeStalkMat);
      stalk.position.set(sgn3 * 0.4, 0.65, 1.0);
      g.add(stalk);
      var eb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), eyeB);
      eb.position.set(sgn3 * 0.4, 0.88, 1.0);
      g.add(eb);
    }
    return g;
  }

  /** 串カツ：串に刺さった具材（丸＋四角）を立体で。前面に Tex.meibutsu("kushikatsu")。 */
  function makeKushikatsu() {
    var g = new THREE.Group();
    var tex = Tex.meibutsu("kushikatsu");

    // 串（細長い円柱）
    var stickMat = new THREE.MeshStandardMaterial({ color: 0xcda86a, roughness: 0.7 });
    var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 8), stickMat);
    g.add(stick);

    // 具材（衣つき＝Tex.meibutsuで質感）。下から3つ刺す。
    var pieceMat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xd9a35a, // きつね色の衣
      roughness: 0.7,
      metalness: 0.0,
      emissive: 0xffcf7a,
      emissiveMap: tex,
      emissiveIntensity: EMIT_NIGHT * 0.5,
    });

    var ys = [-0.9, 0.0, 0.95];
    for (var i = 0; i < ys.length; i++) {
      var piece;
      if (i === 1) {
        // 真ん中は四角い具材
        piece = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), pieceMat);
      } else {
        // 上下は丸い具材
        piece = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), pieceMat);
        piece.scale.set(1.1, 0.95, 1.1);
      }
      piece.position.y = ys[i];
      piece.castShadow = true;
      g.add(piece);
      trackGlow(piece, EMIT_NIGHT * 0.5, EMIT_DAY);
    }
    return g;
  }

  /** 立体看板を1つ建てて register（情報付き）。支柱＋本体を Group に。 */
  function placeMeibutsu(parent, motif, pos, rotY, scale, info) {
    var g = new THREE.Group();
    g.name = "立体看板_" + motif;

    var obj;
    if (motif === "fugu") obj = makeFugu();
    else if (motif === "tako") obj = makeTako();
    else if (motif === "kani") obj = makeKani();
    else obj = makeKushikatsu();

    obj.scale.setScalar(scale || 1);
    g.add(obj);

    // 看板を支える細い支柱（軒先に取り付くイメージ）
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.8, metalness: 0.3 });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), poleMat);
    pole.position.y = -2.6 * (scale || 1);
    g.add(pole);

    g.position.set(pos.x, pos.y, pos.z);
    if (typeof rotY === "number") g.rotation.y = rotY;

    g.userData.info = info;
    g.userData.onNight = function (flag) {
      applyNight(flag);
    };

    City.register(g);
    parent.add(g);
    return g;
  }

  function buildMeibutsuSigns(parent) {
    // ふぐ料理（§12.4）— 西列の店先・通り側、見上げる高さ
    placeMeibutsu(
      parent,
      "fugu",
      { x: -7.5, y: 7.5, z: -14 },
      Math.PI / 2,
      1.15,
      {
        name: "ふぐ料理",
        kind: "sign",
        tag: "ふぐ",
        body:
          "大阪はふぐ消費量が日本トップクラス。新世界には大きなふぐの立体看板がよく似合います。\n" +
          "薄づくり、てっちり（鍋）、唐揚げ——寒くなるほどおいしくなる冬の味覚。\n" +
          "ぷっくり膨らんだ看板を見上げれば、それだけで“大阪に来た感”が爆上がりです。",
      }
    );

    // たこ焼（たこの立体看板）— 東列の店先（§12.9 名物の立体看板）
    placeMeibutsu(
      parent,
      "tako",
      { x: 7.5, y: 7.6, z: -34 },
      -Math.PI / 2,
      1.05,
      {
        name: "名物の立体看板",
        kind: "sign",
        tag: "たこ",
        body:
          "たこ焼、かに、ふぐ……大阪の食いだおれを物語る、ど派手な立体看板。\n" +
          "「でかい・派手・うまそう」が大阪の看板の三原則。\n" +
          "見上げて写真を撮りたくなる、街そのものがテーマパークです。",
      }
    );

    // かに 立体看板 — 東列の店先（§12.9 と同文）
    placeMeibutsu(
      parent,
      "kani",
      { x: 7.5, y: 7.4, z: -6 },
      -Math.PI / 2,
      1.0,
      {
        name: "名物の立体看板",
        kind: "sign",
        tag: "かに",
        body:
          "たこ焼、かに、ふぐ……大阪の食いだおれを物語る、ど派手な立体看板。\n" +
          "「でかい・派手・うまそう」が大阪の看板の三原則。\n" +
          "見上げて写真を撮りたくなる、街そのものがテーマパークです。",
      }
    );

    // 串カツ 立体看板 — 西列の店先（§12.3 串カツ屋）
    placeMeibutsu(
      parent,
      "kushikatsu",
      { x: -7.5, y: 7.6, z: -42 },
      Math.PI / 2,
      1.1,
      {
        name: "串カツ屋",
        kind: "shop",
        tag: "串カツ",
        body:
          "サクッと揚げた串を、共用のソースにくぐらせて一口。\n" +
          "お約束は「ソースの二度づけ禁止」。みんなで使うソースだから、ひと串につき一回だけ。\n" +
          "カウンターで立ち食い、瓶ビール片手にワイワイ——新世界の名物グルメです。",
      }
    );
  }

  // ============================================================
  // 4) ビリケン像
  //    広場（おすすめ位置 (6,0,40)）に台座＋本体（丸い体・尖り頭・笑顔・足裏）。
  //    Tex.billiken を顔/前面に。金色っぽい Standard(metalness0.3, #d9b34a)。
  //    register(kind:"statue")。夜はスポット気味の PointLight。
  // ============================================================
  function buildBilliken(parent) {
    var g = new THREE.Group();
    g.name = "ビリケンさん";

    // ----- 台座（石の四角柱＋天板）-----
    var baseMat = new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.9, metalness: 0.05 });
    var baseTopMat = new THREE.MeshStandardMaterial({ color: 0x837a6e, roughness: 0.85, metalness: 0.05 });
    var pedestal = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.6), baseMat);
    pedestal.position.y = 1.2;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    g.add(pedestal);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.35, 3.0), baseTopMat);
    cap.position.y = 2.55;
    cap.castShadow = true;
    cap.receiveShadow = true;
    g.add(cap);

    // ----- ビリケン本体（金色）-----
    var goldTex = Tex.billiken(); // 顔・前面（笑顔・尖り頭・足裏）を簡易に描いたテクスチャ
    var goldMat = new THREE.MeshStandardMaterial({
      map: goldTex,
      color: 0xd9b34a, // 金色っぽい
      metalness: 0.35,
      roughness: 0.4,
      emissive: 0x4a3a10, // 夜に金が沈まないよう、ほんのり自発光
      emissiveIntensity: 0.0,
    });
    // 夜だけ少し光らせる（applyNight 経由ではなく専用フックで微調整）

    var bili = new THREE.Group();
    // 体（座った卵型：球を縦に伸ばす）
    var bodyGeo = new THREE.SphereGeometry(1.0, 28, 22);
    bodyGeo.scale(0.9, 1.15, 0.85);
    var bodyMesh = new THREE.Mesh(bodyGeo, goldMat);
    bodyMesh.position.y = 1.1;
    bodyMesh.castShadow = true;
    bili.add(bodyMesh);

    // 頭（尖り頭：上が尖るよう、球の上半をコーンで）
    var headGeo = new THREE.SphereGeometry(0.62, 24, 20);
    var headMesh = new THREE.Mesh(headGeo, goldMat);
    headMesh.position.y = 2.25;
    headMesh.castShadow = true;
    bili.add(headMesh);
    // とんがり（頭頂のコーン）
    var topCone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 20), goldMat);
    topCone.position.y = 2.75;
    topCone.castShadow = true;
    bili.add(topCone);

    // 笑った細い目（横長の小さなトーラス/Boxで）
    var faceDark = new THREE.MeshStandardMaterial({ color: 0x4a3a14, roughness: 0.6, metalness: 0.2 });
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), faceDark);
      eye.position.set(sgn * 0.22, 2.3, 0.56);
      bili.add(eye);
    }
    // にっこり口（小さなトーラスの下半分っぽく）
    var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 16, Math.PI), faceDark);
    mouth.rotation.x = Math.PI; // 口角が上がる向き
    mouth.position.set(0, 2.12, 0.56);
    bili.add(mouth);

    // 腕（体側に沿う短い円柱）
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.8, 10), goldMat);
      arm.position.set(s2 * 0.85, 1.2, 0.1);
      arm.rotation.z = s2 * 0.5;
      arm.castShadow = true;
      bili.add(arm);
    }

    // 前に投げ出した足（足裏を正面に見せる＝ビリケンの象徴）
    for (var s3 = -1; s3 <= 1; s3 += 2) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.7, 10), goldMat);
      leg.rotation.x = Math.PI / 2; // 前に伸ばす
      leg.position.set(s3 * 0.38, 0.5, 0.7);
      leg.castShadow = true;
      bili.add(leg);
      // 足裏（正面向きの円盤）
      var sole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 14), goldMat);
      sole.rotation.x = Math.PI / 2;
      sole.position.set(s3 * 0.38, 0.5, 1.06);
      bili.add(sole);
    }

    bili.position.y = 2.75; // 台座天板の上に乗せる
    g.add(bili);

    // 夜はスポット気味の暖色 PointLight（像を下から照らすイメージ）
    City.addDecoLight(0xffe2a8, 1.0, 12, { x: 6.0, y: 5.0, z: 41.5 });

    // 配置（広場・推奨位置）。少しだけ通り側＝南を向ける。
    g.position.set(6, 0, 40);
    g.rotation.y = Math.PI; // 顔を南（カメラ側 −Z）へ

    // 情報（§12.7 ビリケンさん）
    g.userData.info = {
      name: "ビリケンさん",
      kind: "statue",
      tag: "ビリケン",
      body:
        "とんがり頭にニッコリ笑顔、“幸運の神さま”ビリケン。\n" +
        "足の裏をなでるとご利益がある、と言われる新世界のアイドルです。\n" +
        "もともとはアメリカ生まれ。海を越えて、いつのまにか下町の守り神になりました。\n" +
        "さあ、足裏をなでて願いごとを。",
    };
    // 夜は金をほんのり光らせて沈み込みを防ぐ（昼は0）
    g.userData.onNight = function (flag) {
      goldMat.emissiveIntensity = flag ? 0.22 : 0.0;
      applyNight(flag); // 念のため共有発光も同期
    };
    // 初期反映（夜デフォルト）
    var isNight = window.City && typeof City.night === "boolean" ? City.night : true;
    goldMat.emissiveIntensity = isNight ? 0.22 : 0.0;

    City.register(g);
    parent.add(g);
    return g;
  }

  // ============================================================
  // 5) 街灯（がいとう）— 通り沿い・広場に 6〜8 本
  //    ポール＋笠＋電球(emissive)。各球位置に City.addDecoLight(暖色,1.4,20)。
  //    register しない（数が多い）。
  // ============================================================
  function buildStreetLamps(parent) {
    var group = new THREE.Group();
    group.name = "街灯";

    // 共有マテリアル（軽量化）
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x20232a, roughness: 0.7, metalness: 0.4 });
    var shadeMat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.6, metalness: 0.4 });
    var bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff2cc,
      emissive: 0xffd9a0, // 仕様 §3.2 街灯=暖色
      emissiveIntensity: BULB_NIGHT,
      roughness: 0.4,
      metalness: 0.0,
    });

    // 配置点（通りの両脇 x≈±7.5 を Z で散らす＋広場手前に1本）。合計 5 本。
    // ※ PointLight 予算（MAX_POINTLIGHTS=24）の配分内訳：
    //   通天閣2 + 雑居ビル12 + 提灯4 + ビリケン1 + 街灯5 = 24（ちょうど上限）。
    //   以前は街灯7本で合計26となり、最後の広場奥2本が addDecoLight=null →
    //   「電球は光るのに周囲を照らさない街灯」になっていた（不整合）。5本に間引いて解消。
    //   低スペックmobile（フラグメントuniform上限）でのシェーダ負荷も軽減される。
    var spots = [
      { x: -7.5, z: 0 },
      { x: 7.5, z: -20 },
      { x: -7.5, z: -40 },
      { x: 7.5, z: -60 },
      { x: -10, z: 22 }, // 広場（通天閣手前）
    ];

    var lampH = 6.0; // ポール高さ

    for (var i = 0; i < spots.length; i++) {
      var sp = spots[i];
      var lamp = new THREE.Group();

      // ポール
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, lampH, 10), poleMat);
      pole.position.y = lampH / 2;
      pole.castShadow = true;
      lamp.add(pole);

      // 笠（コーンを伏せる）
      var shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 14), shadeMat);
      shade.position.y = lampH + 0.25;
      lamp.add(shade);

      // 電球（発光・笠の下）
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), bulbMat.clone());
      bulb.position.y = lampH - 0.05;
      lamp.add(bulb);
      // 各電球を個別に昼夜トラッキング
      trackGlow(bulb, BULB_NIGHT, BULB_DAY);

      lamp.position.set(sp.x, 0, sp.z);
      group.add(lamp);

      // 実光源（予算内）。球の少し下を照らす暖色。
      // addDecoLight は MAX_POINTLIGHTS 超過時 null を返す。その場合でも電球が
      // “消えている”ように見えないよう、emissive を少し強めてフォールバックする
      // （「光らない街灯」防止。通常は spots=5 で予算内なので発火しない安全網）。
      var lampLight = City.addDecoLight(0xffd9a0, 1.4, 20, { x: sp.x, y: lampH - 0.05, z: sp.z });
      if (!lampLight) {
        bulb.material.emissiveIntensity = BULB_NIGHT * 1.6;
        // 昼夜トラッキングの夜側基準も底上げ（applyNight 後も暗くならない）
        for (var gi = 0; gi < glowItems.length; gi++) {
          if (glowItems[gi].mesh === bulb) {
            glowItems[gi].night = BULB_NIGHT * 1.6;
            break;
          }
        }
      }
    }

    parent.add(group);
    return group; // register しない
  }

  // ============================================================
  // 6) 人影（簡易シルエット）— 通りに 10〜16 体
  //    r137 に CapsuleGeometry が無いので Cylinder（胴）＋Sphere（頭）で作る。
  //    暗色シルエット。register しない。任意で僅かに揺れ。
  // ============================================================
  function makePerson(color) {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.95, metalness: 0.0 });

    // 胴（下太・上細の円柱＝コートを着た人影風）
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.25, 10), mat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    g.add(torso);

    // 肩〜頭をつなぐ（小さい円柱）
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.2, 8), mat);
    neck.position.y = 1.65;
    g.add(neck);

    // 頭
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mat);
    head.position.y = 1.95;
    head.castShadow = true;
    g.add(head);

    // 脚（簡易：1本の太い円柱の裾でまとめる）
    var legs = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.5, 10), mat);
    legs.position.y = 0.25;
    legs.castShadow = true;
    g.add(legs);

    return g;
  }

  function buildPeople(parent) {
    var group = new THREE.Group();
    group.name = "人影";

    // 暗色シルエットのバリエーション（夜の路地に溶ける色味）
    var colors = [0x1c1f26, 0x23262e, 0x2a2630, 0x202a2a, 0x2c2622, 0x1f2630];

    // 通り（X: -9..+9）にランダム配置。建物にめり込まないよう X は ±7 以内。
    // 決定的な配置（毎回同じ）にするため固定座標テーブルを用意（12体）。
    var spots = [
      { x: -3.5, z: 2, ry: 0.3 },
      { x: 2.5, z: -3, ry: -0.8 },
      { x: -1.0, z: -10, ry: 1.2 },
      { x: 4.0, z: -16, ry: 2.4 },
      { x: -4.5, z: -22, ry: 0.6 },
      { x: 1.5, z: -29, ry: -1.5 },
      { x: -2.5, z: -36, ry: 3.0 },
      { x: 3.5, z: -44, ry: 0.1 },
      { x: -3.0, z: -52, ry: -2.0 },
      { x: 0.5, z: -60, ry: 1.7 },
      { x: 2.5, z: -68, ry: -0.4 },
      { x: -4.0, z: -74, ry: 2.1 },
      { x: 6.0, z: 24, ry: 1.0 }, // 広場（通天閣を見上げる人）
      { x: -5.0, z: 30, ry: -1.2 },
    ];

    var swayPeople = [];
    for (var i = 0; i < spots.length; i++) {
      var sp = spots[i];
      var p = makePerson(colors[i % colors.length]);
      p.position.set(sp.x, 0, sp.z);
      p.rotation.y = sp.ry;
      // 体格を少しランダム（決定的）
      var sc = 0.92 + ((i * 37) % 17) / 100; // 0.92〜1.08
      p.scale.set(sc, sc, sc);
      group.add(p);
      swayPeople.push({ mesh: p, phase: i * 1.3, baseRy: sp.ry });
    }

    // ごく僅かに体の向きを揺らす（賑わいの“気配”。重くしない）
    City.onUpdate(function (dt, t) {
      for (var i = 0; i < swayPeople.length; i++) {
        var it = swayPeople[i];
        it.mesh.rotation.y = it.baseRy + Math.sin(t * 0.6 + it.phase) * 0.05;
      }
    });

    parent.add(group);
    return group; // register しない
  }

  // ============================================================
  // 公開 API：build()
  // ============================================================
  window.Props = {
    /**
     * 装飾オブジェクトを配置（City.scene.add、情報を持つものは City.register）。
     * 戻り値は全プロップの親 THREE.Group。
     * @returns {THREE.Group}
     */
    build: function () {
      var root = new THREE.Group();
      root.name = "Props";

      // 1) 赤提灯の列（軒先に連なる・夜発光・揺れ・代表PointLight）
      buildLanterns(root);

      // 2) 暖簾（店先・情報なし）
      buildNorens(root);

      // 3) 立体看板（ふぐ/たこ/かに/串カツ・個別register）
      buildMeibutsuSigns(root);

      // 4) ビリケン像（台座＋金色本体・register・夜スポット）
      buildBilliken(root);

      // 5) 街灯（6〜8本・各球に addDecoLight・register しない）
      buildStreetLamps(root);

      // 6) 人影（12+体・暗色シルエット・register しない）
      buildPeople(root);

      // 各オブジェクトは root にぶら下げてあり（City.register は“情報登録”のみ）、
      // ここで root を一度だけ scene に add して表示する。
      City.scene.add(root);

      return root;
    },
  };
})();

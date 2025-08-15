# CENLEAF ウェブサイト

## 概要
CENLEAFの公式ウェブサイト - オートウェビナーとAIで売上を自動化

## ファイル構成

### メインファイル
- `index.html` - PCメインページ（モバイル自動判定機能付き）
- `mobile.html` - スマホ専用ページ
- `tokutei.html` - 特定商取引法ページ

### ディレクトリ構造
```
cenleaf.com/
├── index.html           # メインページ（PC版）
├── mobile.html          # スマホ専用ページ
├── tokutei.html         # 特定商取引法
├── assets/              # リソースファイル
│   ├── css/            # スタイルシート
│   ├── images/         # 画像ファイル  
│   └── js/             # JavaScriptファイル
├── pages/               # 個別ページ
│   ├── about/          # 会社概要
│   ├── column/         # コラム
│   ├── contact/        # お問い合わせ
│   └── services/       # サービス詳細
├── images/              # 画像リソース
│   ├── profile/        # プロフィール画像
│   ├── services/       # サービス画像
│   └── blog/           # ブログ画像
├── backup/              # バックアップファイル
└── docs/                # ドキュメント
```

## 機能

### モバイル対応
- **自動判定**: index.htmlがアクセスデバイスを自動判定
- **スマホ最適化**: mobile.htmlは完全にスマホ用に最適化
- **レスポンシブ**: 全画面サイズに対応

### 判定条件
1. ユーザーエージェント（iPhone/Android等）
2. 画面幅（768px以下）
3. タッチデバイス

### 主な機能
- ✅ オートウェビナー構築サービス
- ✅ AIクローン作成
- ✅ 売上自動化コンサルティング
- ✅ LINE連携（フローティングボタン）
- ✅ スムーススクロール
- ✅ アニメーション効果

## アップロード方法

### FTPでのアップロード
1. FTPクライアントでサーバーに接続
2. public_html（またはwww）フォルダに全ファイルをアップロード
3. ファイルパーミッションを適切に設定（HTMLは644、フォルダは755）

### 必要なファイル
- index.html（必須）
- mobile.html（必須）
- tokutei.html（特定商取引法）
- assets/フォルダ（CSS/JS/画像）
- images/フォルダ（画像リソース）

## 更新履歴
- 2024年 - スマホ専用ページ（mobile.html）追加
- 2024年 - 自動デバイス判定機能実装
- 2024年 - UI/UX最適化

## お問い合わせ
CENLEAF - https://cenleaf.com

## ライセンス
© 2024 CENLEAF. All rights reserved.trigger pages

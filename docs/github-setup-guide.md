# 📚 cenleaf.com GitHub連携セットアップガイド

## ✅ サーバー情報（設定済み）
- **FTPホスト**: sv7749.xserver.jp
- **FTPユーザー**: cenleaf
- **サーバーパス**: /home/cenleaf/cenleaf.com/public_html/

## 🚀 セットアップ手順

### STEP 1: GitHubリポジトリ作成
1. https://github.com/new にアクセス
2. 以下を入力：
   - **Repository name**: `cenleaf-website`
   - **Description**: cenleaf.com WordPress管理
   - **Private**を選択（非公開推奨）
3. **Create repository**をクリック（README追加はしない）

### STEP 2: GitHub Secretsの設定
1. 作成したリポジトリ https://github.com/rocky77777777/cenleaf-website を開く
2. **Settings**タブをクリック
3. 左メニューの **Secrets and variables** → **Actions**
4. **New repository secret**をクリック
5. 以下を追加：
   - **Name**: `FTP_PASSWORD`
   - **Secret**: （あなたのFTPパスワードを入力）
6. **Add secret**をクリック

### STEP 3: ローカルでの初期設定
```bash
# 1. cenleaf-setupフォルダに移動
cd /Users/suzakijunichi/Library/CloudStorage/GoogleDrive-junichi.suzaki@gmail.com/マイドライブ/Cursor/cenleaf-setup

# 2. Gitリポジトリ初期化
git init

# 3. ファイルを追加
git add .

# 4. 初回コミット
git commit -m "初期設定: cenleaf.com自動デプロイ環境"

# 5. GitHubリポジトリと接続
git remote add origin https://github.com/rocky77777777/cenleaf-website.git

# 6. mainブランチに設定
git branch -M main

# 7. GitHubにプッシュ
git push -u origin main
```

## 📁 ファイル配置方法

### WordPressファイルの配置例
```
cenleaf-setup/
├── wp-content/
│   ├── themes/
│   │   └── your-theme/     # カスタムテーマ
│   ├── plugins/
│   │   └── your-plugin/    # カスタムプラグイン
│   └── mu-plugins/
│       └── custom.php       # Must Useプラグイン
└── assets/
    ├── css/
    ├── js/
    └── images/
```

## 🔄 日常の使い方

### ファイル更新時
```bash
# 1. ファイルを編集

# 2. 変更を確認
git status

# 3. 変更を追加
git add .

# 4. コミット
git commit -m "更新: ○○機能を追加"

# 5. プッシュ（自動デプロイ開始）
git push
```

### デプロイ状況の確認
1. GitHubリポジトリの**Actions**タブを開く
2. 実行中のワークフローを確認
3. 緑のチェック✅が表示されれば成功

## ⚠️ 注意事項

### 絶対にコミットしないファイル
- `wp-config.php`（データベース情報）
- `.env`ファイル（環境変数）
- `/wp-content/uploads/`（アップロード画像）
- データベースのダンプファイル

### 推奨事項
- 大きな変更前はバックアップを取る
- テーマ変更は段階的に行う
- プラグイン更新は一つずつテスト

## 🆘 トラブルシューティング

### デプロイが失敗する場合
1. **Actions**タブでエラーログを確認
2. FTPパスワードが正しく設定されているか確認
3. ファイルパスが正しいか確認

### よくあるエラー
- **Permission denied**: FTPパスワードを再設定
- **Path not found**: server-dirのパスを確認
- **Timeout**: Xサーバーのファイアウォール設定を確認

## 📞 サポート

問題が発生した場合は、GitHubのIssuesに記載するか、直接ご連絡ください。
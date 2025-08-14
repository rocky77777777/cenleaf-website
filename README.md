# cenleaf.com Website

このリポジトリは、cenleaf.comのWordPressサイトを管理します。

## 🚀 自動デプロイ

mainブランチにプッシュすると、自動的にXserverにデプロイされます。

## 📁 ディレクトリ構成

```
cenleaf.com/
├── wp-content/
│   ├── themes/          # カスタムテーマ
│   ├── plugins/         # 管理対象プラグイン
│   └── mu-plugins/      # Must Useプラグイン
├── assets/              # 静的ファイル
│   ├── css/
│   ├── js/
│   └── images/
├── .github/
│   └── workflows/       # GitHub Actions設定
└── README.md
```

## 🔧 初期設定

### 1. リポジトリをクローン
```bash
git clone https://github.com/rocky77777777/cenleaf-website.git
cd cenleaf-website
```

### 2. GitHub Secrets設定

GitHubリポジトリの Settings > Secrets and variables > Actions で以下を設定：

- `FTP_SERVER`: Xサーバーのホスト名（例: sv12345.xserver.jp）
- `FTP_USERNAME`: FTPユーザー名
- `FTP_PASSWORD`: FTPパスワード
- `FTP_PORT`: 21（通常のFTP）または 22（SFTP）
- `FTP_SERVER_DIR`: /home/[ユーザー名]/cenleaf.com/public_html/

### 3. ローカル開発環境

```bash
# ファイル編集後
git add .
git commit -m "更新内容の説明"
git push origin main
# → 自動でサーバーにデプロイ！
```

## 📝 作業フロー

1. **ローカルで編集**
   - テーマファイルの修正
   - プラグインの追加・更新
   - CSSやJSの調整

2. **変更をコミット**
   ```bash
   git add .
   git commit -m "機能: ○○を追加"
   git push
   ```

3. **自動デプロイ**
   - GitHub Actionsが自動実行
   - 数分でサイトに反映

## ⚠️ 注意事項

- `wp-config.php`は絶対にコミットしない
- アップロード画像（wp-content/uploads）は管理対象外
- データベースの変更は手動で実施
- 本番環境での直接編集は避ける

## 🔒 セキュリティ

- FTP情報はGitHub Secretsで暗号化
- .gitignoreで機密ファイルを除外
- プライベートリポジトリ推奨

## 📞 サポート

問題が発生した場合は、Issuesに記載してください。
# Survey Web App

Googleフォームの代わりに、回答をサーバー上のSQLiteデータベースへ保存する小さなPHPアプリです。`/survey/` 配下をそのままFTPにアップロードすれば動作します。

## 使い方

1. `survey/config.php` の `$formDefinition['fields']` を Googleフォームの設問に合わせて書き換えます。`key` は英数字で一意にしてください。
2. 管理用ダウンロードを守るため、サーバー環境変数 `SURVEY_ADMIN_PASSWORD` を設定するか、`config.php` の `$adminPassword` を実運用の値に変更してください。
3. `survey/data/` が書き込み可 (例: 755/775) になっていることを確認します。初回送信時に `survey.sqlite` が自動生成されます。
4. サーバーにアップロードしたら、まず新規利用者は `https://<ドメイン>/survey/register.php` で登録し、登録済みの方は `https://<ドメイン>/survey/login.php` でログインしてください。その後 `https://<ドメイン>/survey/` を開いて送信テストしてください。送信後の履歴・編集は `https://<ドメイン>/survey/history.php` から行えます（ログインが必要）。
   - パスワードはブラウザのセッション（タブを閉じるまで）のみに保持されます。端末をまたぐ場合やブラウザを閉じた後は、再度ログインしてください。
5. 登録状況一覧・CSV確認は `https://<ドメイン>/survey/admin.php` にアクセスし、`config.php` で設定した管理パスワードでログインしてください。

※ Googleフォームにある「記録画像」などのファイルアップロードは、この簡易版では非対応です。URLやメモで記載する形に置き換えています。

## エクスポート

`https://<ドメイン>/survey/api/export.php?password=<管理用パスワード>` にアクセスすると CSV をダウンロードできます。Excel 用に UTF-8 BOM を付与しています。

## ディレクトリ

- `index.php` … フロントエンド (フォーム画面)
- `api/submit.php` … 回答保存 API
- `api/export.php` … CSV エクスポート (パスワード必須)
- `api/login.php` … 担当者ログインチェック
- `data/` … SQLite データベース置き場
- `assets/style.css` … シンプルなスタイル
- `register.php` … ログイン専用の「新規登録」ページ

## デプロイ (FTP)

Xserver の場合、`public_html/survey/` のようなディレクトリを作成して、このフォルダ一式をアップロードしてください。GitHub Actions などの自動デプロイを使う場合も、`survey/` を含めて転送すればOKです。

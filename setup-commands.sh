#!/bin/bash

echo "🚀 cenleaf.com GitHub セットアップを開始します"

# リポジトリ初期化
echo "📁 Gitリポジトリを初期化..."
git init

# 最初のコミット
echo "📝 初期ファイルをコミット..."
git add .
git commit -m "初期設定: cenleaf.com管理用リポジトリ"

# リモートリポジトリ追加
echo "🔗 GitHubリポジトリと接続..."
git remote add origin https://github.com/rocky77777777/cenleaf-website.git

# mainブランチに変更
git branch -M main

# プッシュ
echo "⬆️ GitHubにプッシュ..."
echo "※ 最初のプッシュ時は以下のコマンドを手動で実行してください："
echo "git push -u origin main"

echo ""
echo "✅ セットアップ完了！"
echo ""
echo "📋 次のステップ："
echo "1. GitHubで 'cenleaf-website' リポジトリを作成"
echo "2. Settings > Secrets でFTP情報を設定"
echo "3. git push -u origin main を実行"
// Sanity CLIを使って直接データを作成
import {createClient} from '@sanity/client'

const client = createClient({
  projectId: 'wr3iko59',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: '' // 公開データの読み取りのみ
})

// まず投稿を読み取りテスト
async function testConnection() {
  try {
    const posts = await client.fetch('*[_type == "post"]')
    console.log('現在の投稿数:', posts.length)
    return true
  } catch (error) {
    console.log('接続エラー:', error.message)
    return false
  }
}

testConnection()
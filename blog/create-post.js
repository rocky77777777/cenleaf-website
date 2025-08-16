const sanityClient = require('@sanity/client');
const { nanoid } = require('nanoid');

// Sanityクライアント設定
const client = sanityClient({
  projectId: 'wr3iko59',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_TOKEN, // 書き込み権限のあるトークンが必要
  useCdn: false
});

// 著者を作成または取得
async function createOrGetAuthor() {
  const existingAuthor = await client.fetch(`*[_type == "author" && slug.current == "suzaki-junichi"][0]`);
  
  if (existingAuthor) {
    return existingAuthor._id;
  }

  const author = await client.create({
    _type: 'author',
    name: '須崎純一',
    slug: {
      _type: 'slug',
      current: 'suzaki-junichi'
    },
    bio: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'オートウェビナーとAIで、個人・小規模ビジネスの「集客〜販売」を自動運転化する人。'
          }
        ]
      }
    ]
  });

  return author._id;
}

// カテゴリを作成または取得
async function createOrGetCategory(title, slug, color) {
  const existingCategory = await client.fetch(`*[_type == "category" && slug.current == "${slug}"][0]`);
  
  if (existingCategory) {
    return existingCategory._id;
  }

  const category = await client.create({
    _type: 'category',
    title: title,
    slug: {
      _type: 'slug',
      current: slug
    },
    color: color,
    description: `${title}に関する記事`
  });

  return category._id;
}

// ブログ記事を作成
async function createBlogPost() {
  try {
    // 著者とカテゴリを準備
    const authorId = await createOrGetAuthor();
    const categoryId = await createOrGetCategory('AIツール', 'ai-tools', '#4ECDC4');

    // 記事を作成
    const post = {
      _type: 'post',
      title: '月収1.4万円から年商8桁へ。AIとウェビナーで人生を変えた僕の物語',
      slug: {
        _type: 'slug',
        current: 'my-journey-to-success'
      },
      author: {
        _type: 'reference',
        _ref: authorId
      },
      categories: [
        {
          _type: 'reference',
          _ref: categoryId
        }
      ],
      publishedAt: new Date().toISOString(),
      excerpt: 'ブラック企業でうつ病になり、FXで200万円を失った僕が、AIとウェビナー自動化で年商8桁を達成するまでの赤裸々な物語。',
      body: [
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: 'はじめまして、須崎純一です。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: '今では「AIとウェビナー自動化の専門家」として活動していますが、ここまでの道のりは決して平坦ではありませんでした。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'h2',
          children: [
            {
              _type: 'span',
              text: 'トイレットペーパーが1年で1本も減らない生活'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: '新卒で入った会社は、朝7時出社、深夜2時退社が当たり前のブラック企業。うつ病になり、家ではトイレに行く気力すらなく、トイレットペーパーが1年で1本も減らない廃人のような日々を送っていました。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'h2',
          children: [
            {
              _type: 'span',
              text: '転機は30歳、独立への挑戦'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: 'NTT系ベンチャーで社長賞を獲得しても年功序列の壁に阻まれ、リーマンショックで結婚式3ヶ月前に無職になり、それでも諦めずに30歳で独立を決意。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: '最初はFXで200万円を溶かすという大失敗もしました。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'h2',
          children: [
            {
              _type: 'span',
              text: '月収1.4万円のコーチを3ヶ月で100万円超えへ'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: '転機は友人のコーチを支援したこと。月収1.4万円で苦しんでいた彼を、マーケティングの知識を総動員してサポート。結果、3ヶ月で月収100万円超えを達成させることができました。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'h2',
          children: [
            {
              _type: 'span',
              text: 'AIとウェビナーで作る自動化の仕組み'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: '現在は以下の3つの自動化を軸に、クライアントの売上改革をサポートしています：'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          listItem: 'bullet',
          children: [
            {
              _type: 'span',
              text: '集客の自動化：AI記事生成で月100記事を自動投稿、SNS投稿の完全自動化'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          listItem: 'bullet',
          children: [
            {
              _type: 'span',
              text: 'セールスの自動化：ウェビナーを録画して自動配信、参加者の行動に応じた自動フォローアップ'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          listItem: 'bullet',
          children: [
            {
              _type: 'span',
              text: '納品の自動化：デジタルコンテンツの自動配信、AIチャットボットによる24時間サポート'
            }
          ]
        },
        {
          _type: 'block',
          style: 'h2',
          children: [
            {
              _type: 'span',
              text: '「いつかやりたいを今やろう」'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: 'このモットーを胸に、2020年から2024年まで全国のホテルを転々としながら仕事をし、47都道府県を制覇しました。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: '場所に縛られない働き方の素晴らしさを実感し、今は大阪を拠点に活動しています。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: 'もしあなたが今、売上の頭打ちや集客の悩みを抱えているなら、その答えはAIとウェビナー自動化にあります。'
            }
          ]
        },
        {
          _type: 'block',
          style: 'normal',
          children: [
            {
              _type: 'span',
              text: '一緒に、自動化の未来を作っていきましょう。'
            }
          ]
        }
      ],
      seo: {
        metaTitle: '月収1.4万円から年商8桁へ - 須崎純一の物語',
        metaDescription: 'ブラック企業でうつ病、FXで200万円損失。どん底から這い上がり、AIとウェビナー自動化で成功するまでの物語。'
      }
    };

    const result = await client.create(post);
    console.log('記事が作成されました:', result._id);
    console.log('記事URL: https://cenleaf.com/blog/my-journey-to-success/');
    
    return result;
  } catch (error) {
    console.error('エラー:', error);
    throw error;
  }
}

// 実行
createBlogPost();
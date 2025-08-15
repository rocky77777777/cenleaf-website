import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'category',
  title: 'カテゴリ',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'タイトル',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'スラッグ',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: '説明',
      type: 'text',
    }),
    defineField({
      name: 'color',
      title: 'カテゴリカラー',
      type: 'string',
      description: 'HEXカラーコード（例：#FF5733）',
      validation: (Rule) => Rule.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
        name: 'hex',
        invert: false
      }).error('有効なHEXカラーコードを入力してください'),
    }),
  ],
})
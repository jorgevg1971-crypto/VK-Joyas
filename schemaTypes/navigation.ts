import { defineType, defineField } from 'sanity'

export const navigation = defineType({
  name: 'navigation',
  title: 'Navigation',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Internal name for this navigation menu (e.g. "Main Menu")',
    }),
    defineField({
      name: 'items',
      title: 'Menu Items',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'menuItem',
          title: 'Menu Item',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'linkType',
              title: 'Link Type',
              type: 'string',
              options: {
                list: [
                  { title: 'Static URL', value: 'url' },
                  { title: 'Page Reference', value: 'page' }
                ],
                layout: 'radio'
              },
              initialValue: 'url',
            }),
            defineField({
              name: 'url',
              title: 'Static URL',
              type: 'string',
              description: 'e.g. / or /#catalogo',
              hidden: ({ parent }) => parent?.linkType !== 'url',
            }),
            defineField({
              name: 'pageRef',
              title: 'Page Reference',
              type: 'reference',
              to: [{ type: 'page' }],
              hidden: ({ parent }) => parent?.linkType !== 'page',
            }),
            defineField({
              name: 'subItems',
              title: 'Sub Items',
              type: 'array',
              of: [
                {
                  type: 'object',
                  name: 'subMenuItem',
                  title: 'Sub Menu Item',
                  fields: [
                    defineField({
                      name: 'title',
                      title: 'Title',
                      type: 'string',
                      validation: (rule) => rule.required(),
                    }),
                    defineField({
                      name: 'linkType',
                      title: 'Link Type',
                      type: 'string',
                      options: {
                        list: [
                          { title: 'Static URL', value: 'url' },
                          { title: 'Page Reference', value: 'page' }
                        ],
                        layout: 'radio'
                      },
                      initialValue: 'url',
                    }),
                    defineField({
                      name: 'url',
                      title: 'Static URL',
                      type: 'string',
                      hidden: ({ parent }) => parent?.linkType !== 'url',
                    }),
                    defineField({
                      name: 'pageRef',
                      title: 'Page Reference',
                      type: 'reference',
                      to: [{ type: 'page' }],
                      hidden: ({ parent }) => parent?.linkType !== 'page',
                    }),
                  ]
                }
              ]
            })
          ],
          preview: {
            select: {
              title: 'title',
            },
          },
        },
      ],
    }),
  ],
})

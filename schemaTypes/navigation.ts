import { defineType, defineField } from 'sanity'

export const navigation = defineType({
  name: 'navigation',
  title: 'Navegación',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Título del Menú (Interno)',
      type: 'string',
      description: 'Nombre interno para este menú (ej: "Menú Principal")',
    }),
    defineField({
      name: 'items',
      title: 'Elementos del Menú',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'menuItem',
          title: 'Elemento del Menú',
          fields: [
            defineField({
              name: 'title',
              title: 'Título del Botón',
              type: 'localeString',
              description: 'Título del botón traducible (Español e Inglés).',
            }),
            defineField({
              name: 'linkType',
              title: 'Tipo de Enlace',
              type: 'string',
              options: {
                list: [
                  { title: 'Enlace estático (URL)', value: 'url' },
                  { title: 'Referencia a Página', value: 'page' }
                ],
                layout: 'radio'
              },
              initialValue: 'url',
            }),
            defineField({
              name: 'url',
              title: 'Dirección URL Estática',
              type: 'string',
              description: 'Ej: / o /#catalogo',
              hidden: ({ parent }) => parent?.linkType !== 'url',
            }),
            defineField({
              name: 'pageRef',
              title: 'Página de Destino',
              type: 'reference',
              to: [{ type: 'page' }],
              hidden: ({ parent }) => parent?.linkType !== 'page',
            }),
            defineField({
              name: 'subItems',
              title: 'Sub-elementos (Submenú)',
              type: 'array',
              of: [
                {
                  type: 'object',
                  name: 'subMenuItem',
                  title: 'Elemento del Submenú',
                  fields: [
                    defineField({
                      name: 'title',
                      title: 'Título del Sub-botón',
                      type: 'localeString',
                      description: 'Título del botón traducible (Español e Inglés).',
                    }),
                    defineField({
                      name: 'linkType',
                      title: 'Tipo de Enlace',
                      type: 'string',
                      options: {
                        list: [
                          { title: 'Enlace estático (URL)', value: 'url' },
                          { title: 'Referencia a Página', value: 'page' }
                        ],
                        layout: 'radio'
                      },
                      initialValue: 'url',
                    }),
                    defineField({
                      name: 'url',
                      title: 'Dirección URL Estática',
                      type: 'string',
                      hidden: ({ parent }) => parent?.linkType !== 'url',
                    }),
                    defineField({
                      name: 'pageRef',
                      title: 'Página de Destino',
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
              title: 'title.es',
            },
          },
        },
      ],
    }),
  ],
})

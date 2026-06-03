import { defineType, defineField } from 'sanity'

export const page = defineType({
  name: 'page',
  title: 'Página',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Título',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'content',
      title: 'Contenido de la Página',
      type: 'array',
      description: 'Crea el diseño de tu página añadiendo, ordenando y combinando los siguientes bloques modulares.',
      of: [
        // Bloque de Texto Estándar (envuelto en objeto para habilitar la interfaz "Add item")
        {
          type: 'object',
          name: 'textBlock',
          title: 'Texto Estándar',
          fields: [
            defineField({
              name: 'content',
              title: 'Texto',
              type: 'array',
              of: [{ type: 'block' }],
              validation: (rule) => rule.required(),
            }),
          ],
        },
        
        // Bloque de Texto e Imagen (Split)
        {
          type: 'object',
          name: 'splitBlock',
          title: 'Texto e Imagen (2 Columnas)',
          fields: [
            defineField({
              name: 'text',
              title: 'Texto',
              type: 'array',
              of: [{ type: 'block' }],
            }),
            defineField({
              name: 'image',
              title: 'Imagen',
              type: 'image',
              options: { hotspot: true },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'imagePosition',
              title: 'Posición de la Imagen',
              type: 'string',
              options: {
                list: [
                  { title: 'Derecha', value: 'right' },
                  { title: 'Izquierda', value: 'left' },
                ],
                layout: 'radio',
              },
              initialValue: 'right',
            }),
          ],
        },

        // Bloque de Galería (Grid)
        {
          type: 'object',
          name: 'galleryBlock',
          title: 'Galería de Joyas (Grid)',
          fields: [
            defineField({
              name: 'title',
              title: 'Título de la Galería (Opcional)',
              type: 'string',
            }),
            defineField({
              name: 'images',
              title: 'Imágenes',
              type: 'array',
              of: [
                {
                  type: 'image',
                  options: { hotspot: true },
                  fields: [
                    {
                      name: 'caption',
                      title: 'Descripción / Nombre de la Joya',
                      type: 'string',
                    }
                  ]
                }
              ],
              validation: (rule) => rule.required().min(1),
            }),
            defineField({
              name: 'columns',
              title: 'Columnas en Pantalla Grande',
              type: 'number',
              options: {
                list: [
                  { title: '2 Columnas', value: 2 },
                  { title: '3 Columnas', value: 3 },
                  { title: '4 Columnas', value: 4 },
                ],
              },
              initialValue: 3,
            }),
          ],
        },
      ],
    }),
    defineField({
      name: 'backgroundImage',
      title: 'Imagen de Fondo de la Página',
      type: 'image',
      description: 'Imagen de fondo opcional. Si se deja vacía, se usará un fondo elegante por defecto.',
      options: {
        hotspot: true,
      },
    }),
  ],
})

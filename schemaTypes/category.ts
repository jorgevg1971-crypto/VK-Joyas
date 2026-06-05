import { defineType, defineField } from 'sanity'

export const category = defineType({
  name: 'category',
  title: 'Categoría',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Nombre de la Categoría',
      type: 'localeString',
      description: 'Nombre de la categoría traducible (Español e Inglés).',
    }),
    defineField({
      name: 'slug',
      title: 'Identificador (Slug)',
      type: 'slug',
      description: 'Se usa para la URL y filtros. Haz clic en "Generate" para crearlo automáticamente a partir del nombre en español.',
      options: {
        source: 'name.es',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'visible',
      title: '¿Visible en la Web?',
      type: 'boolean',
      description: 'Si se desmarca, esta categoría y sus productos no se mostrarán en los filtros principales de la web.',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      title: 'name.es',
      subtitle: 'slug.current',
    },
  },
})

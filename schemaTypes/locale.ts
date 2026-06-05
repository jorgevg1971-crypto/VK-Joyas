import { defineType, defineField } from 'sanity'

export const localeString = defineType({
  name: 'localeString',
  title: 'Texto Traducible (Una línea)',
  type: 'object',
  fields: [
    defineField({
      name: 'es',
      title: 'Español',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'en',
      title: 'Inglés',
      type: 'string',
    }),
  ],
})

export const localeText = defineType({
  name: 'localeText',
  title: 'Texto Largo Traducible (Párrafo)',
  type: 'object',
  fields: [
    defineField({
      name: 'es',
      title: 'Español',
      type: 'text',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'en',
      title: 'Inglés',
      type: 'text',
    }),
  ],
})

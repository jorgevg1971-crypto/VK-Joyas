import {defineField, defineType} from 'sanity'
import { orderRankField, orderRankOrdering } from '@sanity/orderable-document-list'

export const product = defineType({
  name: 'product',
  title: 'Producto',
  type: 'document',
  orderings: [orderRankOrdering],
  fields: [
    defineField({
      name: 'name',
      title: 'Nombre del Producto',
      type: 'localeString',
      description: 'Nombre traducible del producto (Español e Inglés).',
    }),
    defineField({
      name: 'price',
      title: 'Precio (Ej: 150 Bs.)',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'showPrice',
      title: '¿Mostrar Precio en la Web?',
      type: 'boolean',
      description: 'Si se desmarca, el precio de este producto no se mostrará en la web ni en el mensaje de WhatsApp.',
      initialValue: true,
    }),
    orderRankField({ type: 'product' }),
    defineField({
      name: 'category',
      title: 'Categoría',
      type: 'reference',
      to: [{ type: 'category' }],
      description: 'Selecciona la categoría a la que pertenece esta joya (debes crear la categoría primero).',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Descripción',
      type: 'localeText',
      description: 'Descripción traducible del producto (Español e Inglés).',
    }),
    defineField({
      name: 'image',
      title: 'Imagen del Producto',
      type: 'image',
      options: {
        hotspot: true,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'visible',
      title: '¿Visible en la Web?',
      type: 'boolean',
      description: 'Si se desmarca, este producto no se mostrará en la web.',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      title: 'name.es',
      subtitle: 'price',
      media: 'image',
      visible: 'visible',
    },
    prepare({ title, subtitle, media, visible }) {
      const isVisible = visible !== false
      return {
        title: `${isVisible ? '' : '❌ '}${title || ''}`,
        subtitle: `${isVisible ? '' : '(OCULTO) '}${subtitle || ''}`,
        media,
      }
    }
  },
})

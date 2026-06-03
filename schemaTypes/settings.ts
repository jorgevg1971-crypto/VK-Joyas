import { defineType, defineField } from 'sanity'

export const settings = defineType({
  name: 'settings',
  title: 'Configuración Global',
  type: 'document',
  fields: [
    defineField({
      name: 'whatsappNumber',
      title: 'Número de WhatsApp',
      type: 'string',
      description: 'Número telefónico con código de país al que se enviarán las solicitudes de compra (ej. +59175873118).',
      validation: (rule) => rule.required().regex(/^\+?[1-9]\d{1,14}$/).error('Por favor ingresa un formato de número válido (ej. +59175873118)'),
    }),
  ],
})

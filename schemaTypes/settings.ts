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
    defineField({
      name: 'whatsappButtonText',
      title: 'Texto del Botón de WhatsApp',
      type: 'localeString',
      description: 'Texto personalizado para el botón de WhatsApp. Si se deja vacío, se usará "Pedir por WhatsApp" (o "Order via WhatsApp" en inglés).',
    }),
    defineField({
      name: 'heroImage',
      title: 'Imagen de Portada (Hero)',
      type: 'image',
      description: 'Imagen de fondo para la portada de la página de inicio. Si se deja vacía, se usará la de anillos por defecto.',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'heroButtonText',
      title: 'Texto del Botón de la Portada',
      type: 'localeString',
      description: 'Texto personalizado para el botón principal de la portada. Si se deja vacío, se usará "Ver Colección" (o "View Collection" en inglés).',
    }),
    defineField({
      name: 'heroButtonTarget',
      title: 'Destino del Botón de la Portada',
      type: 'string',
      options: {
        list: [
          { title: 'Colección Completa (Sección de Productos)', value: 'catalogo' },
          { title: 'Nuestras Categorías (Sección de Categorías)', value: 'home-categories' },
        ]
      },
      initialValue: 'catalogo',
      description: 'Selecciona la sección de la página de inicio a la que se desplazará la pantalla al pulsar el botón.',
    }),
    defineField({
      name: 'showFullCollection',
      title: 'Mostrar Colección Completa en la Portada',
      type: 'boolean',
      initialValue: true,
      description: 'Si se desmarca, la sección "Colección Completa" (grilla de todos los productos) se ocultará de la página de inicio, pero se mostrará al seleccionar una categoría específica.',
    }),
    defineField({
      name: 'socialLinks',
      title: 'Redes Sociales',
      type: 'array',
      description: 'Añade, edita, reordena o desactiva enlaces a tus redes sociales para mostrarlos en el pie de página.',
      of: [
        {
          type: 'object',
          name: 'socialLink',
          title: 'Enlace de Red Social',
          fields: [
            defineField({
              name: 'platform',
              title: 'Plataforma',
              type: 'string',
              options: {
                list: [
                  { title: 'Facebook', value: 'facebook' },
                  { title: 'Instagram', value: 'instagram' },
                  { title: 'TikTok', value: 'tiktok' },
                  { title: 'Pinterest', value: 'pinterest' },
                  { title: 'YouTube', value: 'youtube' },
                ]
              },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'url',
              title: 'Dirección URL de tu Perfil',
              type: 'url',
              validation: (rule) => rule.required().uri({
                scheme: ['http', 'https']
              }).error('Por favor ingresa un enlace web válido (ej: https://facebook.com/vkjoyas)'),
            }),
            defineField({
              name: 'visible',
              title: '¿Mostrar en la Web?',
              type: 'boolean',
              initialValue: true,
            })
          ],
          preview: {
            select: {
              title: 'platform',
              subtitle: 'url',
              visible: 'visible',
            },
            prepare(selection) {
              const { title, subtitle, visible } = selection;
              const formattedTitle = title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Sin plataforma';
              const visibility = visible === false ? ' (Oculto)' : '';
              return {
                title: `${formattedTitle}${visibility}`,
                subtitle: subtitle,
              };
            }
          }
        }
      ]
    }),
  ],
})

import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'VK Joyas Admin',

  projectId: '9v40s6dm',
  dataset: 'production',
  basePath: '/admin',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Contenido')
          .items([
            // Singleton para la Configuración Global
            S.listItem()
              .title('Configuración Global')
              .id('settings')
              .child(
                S.document()
                  .schemaType('settings')
                  .documentId('settings')
                  .title('Configuración Global')
              ),
            S.divider(),
            // Filtrar settings de la lista normal para que no aparezca duplicada
            ...S.documentTypeListItems().filter(
              (item) => !['settings'].includes(item.getId() || '')
            ),
          ]),
    }),
    visionTool()
  ],

  schema: {
    types: schemaTypes,
    // Previene la creación de nuevos documentos 'settings' desde el botón "+" general
    templates: (templates) =>
      templates.filter((template) => template.schemaType !== 'settings'),
  },
})

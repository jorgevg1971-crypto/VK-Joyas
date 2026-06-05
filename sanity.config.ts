import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {BulkDelete} from './components/BulkDelete'
import {schemaTypes} from './schemaTypes'
import {orderableDocumentListDeskItem} from '@sanity/orderable-document-list'

export default defineConfig({
  name: 'default',
  title: 'VK Joyas Admin',

  projectId: '9v40s6dm',
  dataset: 'production',
  basePath: '/admin',

  plugins: [
    structureTool({
      structure: (S, context) => {
        const client = context.getClient({apiVersion: '2021-10-21'});
        return client.fetch(`*[_type == "category"] | order(orderRank asc){_id, name}`).then((categories: any[]) => {
          return S.list()
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
              // Categorías (Orden Visual)
              orderableDocumentListDeskItem({
                type: 'category',
                title: 'Categorías (Orden Visual)',
                id: 'orderable-categories',
                S,
                context
              }),
              // Productos por Categoría (Orden Visual)
              S.listItem()
                .title('Productos por Categoría')
                .child(
                  S.list()
                    .title('Selecciona una Categoría')
                    .items(
                      categories.map((cat) =>
                        orderableDocumentListDeskItem({
                          type: 'product',
                          title: cat.name?.es || cat.name?.en || 'Sin nombre',
                          id: `orderable-products-${cat._id}`,
                          filter: `_type == "product" && category._ref == $categoryId`,
                          params: { categoryId: cat._id },
                          S,
                          context
                        })
                      )
                    )
                ),
              S.divider(),
              // Filtrar settings, category y product de la lista normal
              ...S.documentTypeListItems().filter(
                (item) => !['settings', 'category', 'product'].includes(item.getId() || '')
              ),
            ]);
        });
      },
    }),
    visionTool(),
    BulkDelete({
      schemaTypes: schemaTypes,
    }),
  ],

  schema: {
    types: schemaTypes,
    // Previene la creación de nuevos documentos 'settings' desde el botón "+" general
    templates: (templates) =>
      templates.filter((template) => template.schemaType !== 'settings'),
  },
})

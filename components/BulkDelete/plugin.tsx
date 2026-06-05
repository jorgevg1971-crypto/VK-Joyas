import React from 'react'
import {definePlugin} from 'sanity'
import {BulkDeleteComponent} from './BulkDeleteComponent'
import type {BulkDeleteToolOptions} from './BulkDeleteComponent.types'
import {ToastProvider} from '@sanity/ui'

/**
 * Sanity plugin definition for the Bulk Delete tool.
 * @public
 */
export const BulkDelete = definePlugin<BulkDeleteToolOptions>(config => ({
  name: 'sanity-plugin-bulk-delete',
  tools: [
    {
      name: 'bulk-delete',
      title: 'Bulk Delete',
      component: function BulkDeleteTool() {
        return (
          <ToastProvider>
            <BulkDeleteComponent {...config} />
          </ToastProvider>
        )
      },
    },
  ],
}))

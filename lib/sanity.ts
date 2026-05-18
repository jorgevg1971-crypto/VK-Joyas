import {createClient} from 'next-sanity'

export const client = createClient({
  projectId: '9v40s6dm',
  dataset: 'production',
  apiVersion: '2024-05-18', // Fecha actual recomendada
  useCdn: false, // useCdn debe ser false para ver actualizaciones instantáneas
})

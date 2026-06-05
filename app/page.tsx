import { client } from '@/lib/sanity';
import Catalog from '@/components/Catalog';

export const revalidate = 60; // Revalida cada 60 segundos

export default async function Page() {
  // Consulta conjunta de productos y categorías ordenados manualmente por prioridad (order asc)
  const data = await client.fetch(`
    {
      "products": *[_type == "product"] | order(orderRank asc, name.es asc) {
        _id,
        name,
        price,
        "showPrice": coalesce(showPrice, true),
        // Compatibilidad: si es referencia obtiene el slug, si es texto viejo lo deja tal cual
        "category": coalesce(category->slug.current, category),
        "categoryName": coalesce(category->name, category),
        description,
        "imageUrl": image.asset->url
      },
      "categories": *[_type == "category" && visible == true] | order(orderRank asc, name.es asc) {
        _id,
        name,
        "slug": slug.current
      },
      "settings": *[_type == "settings"][0] {
        whatsappNumber,
        "heroImageUrl": heroImage.asset->url
      }
    }
  `);

  return (
    <Catalog 
      products={data.products || []} 
      categories={data.categories || []}
      whatsappNumber={data.settings?.whatsappNumber}
      heroImageUrl={data.settings?.heroImageUrl}
    />
  );
}

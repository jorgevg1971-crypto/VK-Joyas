import { client } from '@/lib/sanity';
import Catalog from '@/components/Catalog';

export const revalidate = 60; // Revalida cada 60 segundos

export default async function Page() {
  // Realiza una consulta conjunta de productos, categorías visibles y configuración en una sola llamada
  const data = await client.fetch(`
    {
      "products": *[_type == "product"] {
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
      "categories": *[_type == "category" && visible == true] | order(name asc) {
        _id,
        name,
        "slug": slug.current
      },
      "settings": *[_type == "settings"][0] {
        whatsappNumber
      }
    }
  `);

  return (
    <Catalog 
      products={data.products || []} 
      categories={data.categories || []}
      whatsappNumber={data.settings?.whatsappNumber} 
    />
  );
}

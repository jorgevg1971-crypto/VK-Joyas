import { client } from '@/lib/sanity';
import Catalog from '@/components/Catalog';

export const revalidate = 60; // Revalida cada 60 segundos

export default async function Page() {
  // Consulta conjunta de productos y categorías ordenados manualmente por prioridad (order asc)
  const data = await client.fetch(`
    {
      "products": *[_type == "product" && coalesce(visible, true) == true && category->visible == true] | order(orderRank asc, name.es asc) {
        _id,
        name,
        price,
        "isOnSale": coalesce(isOnSale, false),
        "showPrice": coalesce(showPrice, true),
        "category": category->slug.current,
        "categoryName": category->name,
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
        whatsappButtonText,
        heroButtonText,
        heroButtonTarget,
        "showFullCollection": coalesce(showFullCollection, true),
        "heroImageUrl": heroImage.asset->url
      }
    }
  `);

  return (
    <Catalog 
      products={data.products || []} 
      categories={data.categories || []}
      whatsappNumber={data.settings?.whatsappNumber}
      whatsappButtonText={data.settings?.whatsappButtonText}
      heroButtonText={data.settings?.heroButtonText}
      heroButtonTarget={data.settings?.heroButtonTarget}
      showFullCollection={data.settings?.showFullCollection}
      heroImageUrl={data.settings?.heroImageUrl}
    />
  );
}

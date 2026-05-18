import { client } from '@/lib/sanity';
import Catalog from '@/components/Catalog';

export const revalidate = 60; // Revalida cada 60 segundos

export default async function Page() {
  const products = await client.fetch(`
    *[_type == "product"] {
      _id,
      name,
      price,
      category,
      description,
      "imageUrl": image.asset->url
    }
  `);

  return <Catalog products={products} />;
}

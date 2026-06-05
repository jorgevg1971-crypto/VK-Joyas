import { client } from '@/lib/sanity';
import { notFound } from 'next/navigation';
import DynamicPageContent from '@/components/DynamicPageContent';

export const revalidate = 60;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const pageData = await client.fetch(`
    *[_type == "page" && slug.current == $slug][0] {
      title,
      content[] {
        ...,
        _type == "splitBlock" => {
          ...,
          "imageUrl": image.asset->url
        },
        _type == "galleryBlock" => {
          ...,
          images[] {
            ...,
            "imageUrl": asset->url
          }
        }
      },
      "imageUrl": backgroundImage.asset->url
    }
  `, { slug });

  if (!pageData) {
    notFound();
  }

  return <DynamicPageContent pageData={pageData} />;
}

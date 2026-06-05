import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { client } from "@/lib/sanity";
import { LanguageProvider } from "@/context/LanguageContext";

const inter = Inter({ subsets: ["latin"], variable: '--font-body' });
const playfair = Playfair_Display({ subsets: ["latin"], variable: '--font-heading' });

export const metadata: Metadata = {
  title: "VK Joyas | Joyería Fina en Plata 925",
  description: "Joyería artesanal de plata ley 925. Anillos, aretes, dijes y manillas exclusivas hechas a mano.",
};

export const revalidate = 60;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Consulta paralela del menú de navegación y de los enlaces de redes sociales
  const data = await client.fetch(`
    {
      "navigation": *[_type == "navigation"][0] {
        items[]{
          _key,
          title,
          linkType,
          url,
          pageRef->{ slug },
          subItems[]{
            _key,
            title,
            linkType,
            url,
            pageRef->{ slug }
          }
        }
      },
      "settings": *[_type == "settings"][0] {
        socialLinks[] {
          _key,
          platform,
          url,
          visible
        }
      }
    }
  `);

  const menuItems = data?.navigation?.items || [];
  const socialLinks = data?.settings?.socialLinks || [];

  return (
    <html lang="es">
      <body className={`${inter.variable} ${playfair.variable}`}>
        <LanguageProvider>
          <Navbar items={menuItems} />
          <main style={{ minHeight: '80vh' }}>
            {children}
          </main>
          <Footer socialLinks={socialLinks} />
        </LanguageProvider>
      </body>
    </html>
  );
}

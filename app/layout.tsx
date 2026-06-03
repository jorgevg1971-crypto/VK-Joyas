import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { client } from "@/lib/sanity";

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
  const navData = await client.fetch(`
    *[_type == "navigation"][0] {
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
    }
  `);

  const menuItems = navData?.items || [];

  return (
    <html lang="es">
      <body className={`${inter.variable} ${playfair.variable}`}>
        <Navbar items={menuItems} />
        <main style={{ minHeight: '80vh' }}>
          {children}
        </main>
        <footer>
          <p>&copy; {new Date().getFullYear()} VK Joyas. Todos los derechos reservados. Diseño en Plata 925.</p>
        </footer>
      </body>
    </html>
  );
}

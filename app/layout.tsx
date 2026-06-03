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
  // Filtramos para obtener únicamente las redes sociales visibles
  const socialLinks = data?.settings?.socialLinks?.filter((link: any) => link.visible !== false) || [];

  return (
    <html lang="es">
      <body className={`${inter.variable} ${playfair.variable}`}>
        <Navbar items={menuItems} />
        <main style={{ minHeight: '80vh' }}>
          {children}
        </main>
        <footer>
          {socialLinks.length > 0 && (
            <div className="footer-socials">
              {socialLinks.map((link: any) => {
                let iconSvg = null;
                switch (link.platform) {
                  case 'facebook':
                    iconSvg = (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    );
                    break;
                  case 'instagram':
                    iconSvg = (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                      </svg>
                    );
                    break;
                  case 'tiktok':
                    iconSvg = (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.54-4.06-1.41-.65-.48-1.2-1.12-1.6-1.83v7.7c.07 2.12-.66 4.31-2.28 5.72-1.74 1.55-4.29 2.01-6.49 1.34-2.44-.73-4.43-2.79-4.88-5.32-.58-3.08.79-6.39 3.51-7.76 1.34-.68 2.89-.89 4.37-.62v4.13c-.92-.25-1.92-.12-2.73.38-.97.58-1.5 1.74-1.43 2.86.05 1.14.73 2.21 1.74 2.73 1.13.58 2.58.4 3.52-.43.68-.6 1-.16 1.01-1.07V.02z"/>
                      </svg>
                    );
                    break;
                  case 'pinterest':
                    iconSvg = (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.948-.199-2.403.041-3.439.219-.937 1.406-5.966 1.406-5.966s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.27 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.62 0 11.988-5.371 11.988-11.995C24.005 5.367 18.636 0 12.017 0z"/>
                      </svg>
                    );
                    break;
                  case 'youtube':
                    iconSvg = (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.507 9.388.507 9.388.507s7.518 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    );
                    break;
                }

                if (!iconSvg) return null;

                return (
                  <a 
                    key={link._key} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="social-icon-link"
                    title={link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                  >
                    {iconSvg}
                  </a>
                );
              })}
            </div>
          )}
          <p>&copy; {new Date().getFullYear()} VK Joyas. Todos los derechos reservados. Diseño en Plata 925.</p>
        </footer>
      </body>
    </html>
  );
}

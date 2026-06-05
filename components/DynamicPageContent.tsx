"use client";

import { PortableText } from '@portabletext/react';
import { useLanguage } from '@/context/LanguageContext';
import DynamicPageLayout from '@/components/DynamicPageLayout';

interface DynamicPageContentProps {
  pageData: {
    title: any;
    content: any[];
    imageUrl?: string;
  };
}

export default function DynamicPageContent({ pageData }: DynamicPageContentProps) {
  const { language, t } = useLanguage();

  const getLocalized = (val: any) => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      return val[language] || val['es'] || '';
    }
    return '';
  };

  // Componentes personalizados para renderizar bloques en PortableText con traducciones
  const portableTextComponents = {
    types: {
      // Bloque de texto estándar (traducible)
      textBlock: ({ value }: any) => {
        if (!value) return null;
        const textContent = language === 'en' && value.contentEn && value.contentEn.length > 0
          ? value.contentEn 
          : value.contentEs;
          
        if (!textContent) return null;
        return (
          <div style={{ margin: '2rem 0', color: '#cbd5e1', fontSize: '1.1rem', lineHeight: '1.8' }}>
            <PortableText value={textContent} />
          </div>
        );
      },

      // Bloque dividido (Texto e Imagen en 2 Columnas, traducible)
      splitBlock: ({ value }: any) => {
        const isLeft = value.imagePosition === 'left';
        const textContent = language === 'en' && value.textEn && value.textEn.length > 0
          ? value.textEn 
          : value.textEs;

        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2.5rem',
            margin: '3.5rem 0',
            alignItems: 'center',
          }}>
            {isLeft ? (
              <>
                {value.imageUrl && (
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
                    <img src={value.imageUrl} alt="Sección visual" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ color: '#e2e8f0', fontSize: '1.1rem', lineHeight: '1.8' }}>
                  {textContent && <PortableText value={textContent} />}
                </div>
              </>
            ) : (
              <>
                <div style={{ color: '#e2e8f0', fontSize: '1.1rem', lineHeight: '1.8' }}>
                  {textContent && <PortableText value={textContent} />}
                </div>
                {value.imageUrl && (
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
                    <img src={value.imageUrl} alt="Sección visual" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      },

      // Bloque de Galería de fotos (Grid, traducible)
      galleryBlock: ({ value }: any) => {
        const galleryTitle = getLocalized(value.title);
        return (
          <div style={{ margin: '4rem 0' }}>
            {galleryTitle && (
              <h2 style={{ 
                fontSize: '1.8rem', 
                color: '#ffffff', 
                marginBottom: '2rem', 
                textAlign: 'center', 
                fontFamily: 'var(--font-heading)',
                letterSpacing: '1.5px',
                textTransform: 'uppercase'
              }}>
                {galleryTitle}
              </h2>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
              gap: '1.5rem'
            }}>
              {value.images?.map((img: any, idx: number) => {
                const imgCaption = getLocalized(img.caption);
                return (
                  <div key={idx} style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 5px 20px rgba(0,0,0,0.3)',
                    backgroundColor: 'rgba(23, 23, 23, 0.4)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {img.imageUrl && (
                      <div style={{ overflow: 'hidden', height: '240px' }}>
                        <img 
                          src={img.imageUrl} 
                          alt={imgCaption || "Imagen de Galería"} 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            display: 'block',
                          }} 
                        />
                      </div>
                    )}
                    {imgCaption && (
                      <div style={{ 
                        padding: '0.8rem 1rem', 
                        fontSize: '0.95rem', 
                        color: '#cbd5e1', 
                        textAlign: 'center', 
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: 'rgba(15, 15, 15, 0.6)',
                        flexGrow: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {imgCaption}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
    }
  };

  // Configuración del fondo
  const bgStyle = pageData.imageUrl 
    ? { background: `linear-gradient(rgba(10,10,10,0.7), rgba(10,10,10,0.85)), url(${pageData.imageUrl}) center/cover fixed` }
    : { background: `linear-gradient(rgba(10,10,10,0.85), rgba(10,10,10,0.95)), url('/img/anillos_1.png') center/cover fixed, #0a0a0a` };

  return (
    <DynamicPageLayout bgStyle={bgStyle}>
      <div style={{ 
        padding: '3.5rem', 
        backgroundColor: 'rgba(23, 23, 23, 0.8)', 
        backdropFilter: 'blur(12px)', 
        borderRadius: '16px', 
        border: '1px solid rgba(255,255,255,0.06)', 
        boxShadow: '0 15px 40px rgba(0,0,0,0.6)' 
      }}>
        <h1 style={{ 
          fontSize: '2.8rem', 
          marginBottom: '2.5rem', 
          color: '#ffffff', 
          textAlign: 'center', 
          letterSpacing: '3px', 
          fontFamily: 'var(--font-heading)',
          textTransform: 'uppercase',
          borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '1.5rem'
        }}>
          {getLocalized(pageData.title)}
        </h1>
        <div className="prose" style={{ color: '#cbd5e1' }}>
          <PortableText value={pageData.content} components={portableTextComponents} />
        </div>
      </div>
    </DynamicPageLayout>
  );
}

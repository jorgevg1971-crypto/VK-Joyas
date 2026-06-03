"use client";

import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DynamicPageLayoutProps {
  bgStyle: React.CSSProperties;
  children: React.ReactNode;
}

export default function DynamicPageLayout({ bgStyle, children }: DynamicPageLayoutProps) {
  const router = useRouter();

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Solo redirige a la página principal si se hace clic exactamente en el fondo,
    // y no en la tarjeta de contenido o sus elementos internos.
    if (e.target === e.currentTarget) {
      router.push('/');
    }
  };

  return (
    <div 
      onClick={handleBackgroundClick} 
      style={{ 
        ...bgStyle, 
        minHeight: '90vh', 
        padding: '4rem 1rem', 
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          cursor: 'default',
          width: '100%',
          maxWidth: '1000px',
          position: 'relative' // Necesario para posicionar absolutamente el botón de cerrar
        }}
      >
        {/* Botón de cerrar elegante tipo "floating cross" */}
        <Link 
          href="/" 
          aria-label="Cerrar y volver al inicio"
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            width: '2.8rem',
            height: '2.8rem',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a3a3a3',
            fontSize: '1.6rem',
            textDecoration: 'none',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 50,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.08) rotate(90deg)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#a3a3a3';
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          &times;
        </Link>
        {children}
      </div>
    </div>
  );
}

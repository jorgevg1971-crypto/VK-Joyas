"use client";

import React, { useCallback, useState } from 'react';
import { set } from 'sanity';

// Convertir bloques de Portable Text (Rich Text) a texto plano
const toPlainText = (blocks: any[] = []) => {
  if (!blocks || !Array.isArray(blocks)) return '';
  return blocks
    .map((block: any) => {
      if (block._type !== 'block' || !block.children) {
        return '';
      }
      return block.children.map((c: any) => c.text).join('');
    })
    .join('\n');
};

// Convertir texto plano de vuelta a bloques de Portable Text estructurados de Sanity
const toPortableText = (text: string) => {
  if (!text) return [];
  return text.split('\n').map((line) => ({
    _type: 'block',
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        text: line,
        marks: []
      }
    ]
  }));
};

export const BilingualBlockInput = (props: any) => {
  const { onChange, value = {}, esField, enField } = props;
  const [loading, setLoading] = useState(false);

  const esValue = value?.[esField];

  const handleTranslate = useCallback(async () => {
    if (!esValue || (Array.isArray(esValue) && esValue.length === 0)) return;

    setLoading(true);
    try {
      const plainText = toPlainText(esValue);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=en&dt=t&q=${encodeURIComponent(plainText)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translatedText = data[0].map((x: any) => x[0]).join('');
      
      if (translatedText) {
        const portableText = toPortableText(translatedText);
        onChange(set(portableText, [enField]));
      }
    } catch (err) {
      console.error('Error translating block:', err);
    } finally {
      setLoading(false);
    }
  }, [esValue, enField, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {props.renderDefault(props)}
      {esValue && (!Array.isArray(esValue) || esValue.length > 0) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.3rem' }}>
          <button
            type="button"
            onClick={handleTranslate}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: loading ? 'default' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              padding: '0.2rem 0.5rem',
              outline: 'none',
              transition: 'opacity 0.2s ease',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            {loading ? 'Traduciendo...' : 'Traducir al Inglés (Auto)'}
          </button>
        </div>
      )}
    </div>
  );
};

export const TextBlockInput = (props: any) => (
  <BilingualBlockInput {...props} esField="contentEs" enField="contentEn" />
);

export const SplitBlockInput = (props: any) => (
  <BilingualBlockInput {...props} esField="textEs" enField="textEn" />
);

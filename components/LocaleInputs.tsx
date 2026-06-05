"use client";

import React, { useCallback, useState } from 'react';
import { set } from 'sanity';

export const LocaleStringInput = (props: any) => {
  const { onChange, value = {} } = props;
  const [loading, setLoading] = useState(false);

  const handleTranslate = useCallback(async () => {
    const esText = value?.es;
    if (!esText) return;

    setLoading(true);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=en&dt=t&q=${encodeURIComponent(esText)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translation = data[0].map((x: any) => x[0]).join('');
      
      if (translation) {
        onChange(set(translation, ['en']));
      }
    } catch (err) {
      console.error('Error translating:', err);
    } finally {
      setLoading(false);
    }
  }, [value?.es, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {props.renderDefault(props)}
      {value?.es && (
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

export const LocaleTextInput = (props: any) => {
  const { onChange, value = {} } = props;
  const [loading, setLoading] = useState(false);

  const handleTranslate = useCallback(async () => {
    const esText = value?.es;
    if (!esText) return;

    setLoading(true);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=en&dt=t&q=${encodeURIComponent(esText)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translation = data[0].map((x: any) => x[0]).join('');
      
      if (translation) {
        onChange(set(translation, ['en']));
      }
    } catch (err) {
      console.error('Error translating:', err);
    } finally {
      setLoading(false);
    }
  }, [value?.es, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {props.renderDefault(props)}
      {value?.es && (
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

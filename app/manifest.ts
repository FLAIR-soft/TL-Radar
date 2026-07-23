import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TL-Radar',
    short_name: 'TL-Radar',
    description: 'Wer macht was und wo — ohne lange Nachfragen.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f5f5f7',
    theme_color: '#e20617',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

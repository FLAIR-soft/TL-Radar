import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TL-Organizer',
    short_name: 'TL-Organizer',
    description: 'Wer macht was und wo — ohne lange Nachfragen.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#EDEDED',
    theme_color: '#e20617',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

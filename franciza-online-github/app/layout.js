import './globals.css';
import { Montserrat } from 'next/font/google';
import { I18nProvider } from '@/components/I18n';
import { SITE } from '@/lib/site';

const font = Montserrat({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font',
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: `${SITE.product} — agenția ta de turism, fără birou`,
  description:
    'Lucrează de acasă cu brandul, sistemul de rezervări, CRM-ul și suportul Panda Tour. Comision lunar. Aplică pentru Franciza Online.',
  icons: { icon: '/img/logo.png' },
  openGraph: {
    title: SITE.product,
    description: 'Agenția ta de turism online — fără birou fizic. Aplică acum.',
    images: ['/img/hero.jpg'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#01b9ef',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ro" className={font.variable}>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

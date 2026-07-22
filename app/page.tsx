import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Radar, Kanban, Timer, BarChart3, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getThemeCookie } from '@/lib/theme/cookie';
import { LocaleProvider } from '@/lib/i18n/LocaleContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LandingScreenshot } from '@/components/LandingScreenshot';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

function FeatureCard({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="feature-card">
      <div className="feature-card-icon">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div className="feature-card-title">{title}</div>
      <p className="feature-card-desc">{desc}</p>
    </div>
  );
}

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  const locale = await getLocaleCookie();
  const dict: Dictionary = getDictionary(locale);
  const theme = await getThemeCookie();

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <div className="landing">
        <header className="landing-nav">
          <div className="topbar-brand">
            <span className="topbar-brand-icon">
              <Radar size={20} strokeWidth={2.25} />
            </span>
            <span className="topbar-brand-name">TL-Radar</span>
          </div>
          <div className="landing-nav-actions">
            <ThemeToggle theme={theme} />
            <LanguageSwitcher />
            <Link href="/login" className="btn btn-primary">
              {dict.auth.signInButton}
            </Link>
          </div>
        </header>

        <section className="landing-hero">
          <span className="landing-eyebrow">{dict.landing.eyebrow}</span>
          <h1 className="landing-headline">{dict.landing.headline}</h1>
          <p className="landing-subheadline">{dict.landing.subheadline}</p>
          <div className="landing-hero-ctas">
            <Link href="/login" className="btn btn-primary btn-lg">
              {dict.auth.signInButton}
            </Link>
            <a href="#product" className="btn btn-ghost btn-lg">
              {dict.landing.ctaDemo}
            </a>
          </div>
        </section>

        <section className="landing-screenshot" id="product">
          <LandingScreenshot dict={dict} />
          <p className="landing-screenshot-caption">{dict.landing.screenshotCaption}</p>
        </section>

        <section className="landing-features">
          <h2 className="landing-features-title">{dict.landing.featuresTitle}</h2>
          <div className="feature-grid">
            <FeatureCard icon={Kanban} title={dict.landing.feature1Title} desc={dict.landing.feature1Desc} />
            <FeatureCard icon={Timer} title={dict.landing.feature2Title} desc={dict.landing.feature2Desc} />
            <FeatureCard icon={BarChart3} title={dict.landing.feature3Title} desc={dict.landing.feature3Desc} />
            <FeatureCard icon={Globe} title={dict.landing.feature4Title} desc={dict.landing.feature4Desc} />
          </div>
        </section>

        <footer className="landing-footer">
          <div className="topbar-brand">
            <span className="topbar-brand-icon">
              <Radar size={18} strokeWidth={2.25} />
            </span>
            <span className="topbar-brand-name">TL-Radar</span>
          </div>
          <p className="landing-footer-rights">
            © {new Date().getFullYear()} TL-Radar — {dict.landing.footerRights}
          </p>
        </footer>
      </div>
    </LocaleProvider>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import LogoTile from '../LogoTile';
import SiteButton from '../SiteButton';
import SiteLink from '../SiteLink';
import {
  INDUSTRY_ITEMS,
  PARTNERS_ITEMS,
  PLATFORM_LOGOS,
  PRODUCT_ITEMS,
  RESOURCES_ITEMS,
  TEAM_ITEMS,
  type DropItem,
  type IconItem,
} from './menuData';
import { DESKTOP_NAV_MIN_WIDTH } from './breakpoints';
import styles from './SiteHeader.module.css';

type MenuId = 'product' | 'solutions' | 'resources' | 'partners';
type OpenedBy = 'hover' | 'click' | 'focus';

const CLOSE_DELAY_MS = 120;
const FOCUSABLE =
  'a[href], a[tabindex], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export default function SiteHeader() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const pathname = usePathname();

  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const openedBy = useRef<OpenedBy>('hover');
  const suppressFocusOpen = useRef(false);

  const [openId, setOpenId] = useState<MenuId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<MenuId | null>(null);
  const [panelTop, setPanelTop] = useState(78);

  // Cerrar todo al cambiar de ruta (ajuste de estado durante el render)
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpenId(null);
    setMobileOpen(false);
  }

  const clearTimer = useCallback(() => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  }, []);

  const openMenu = useCallback(
    (id: MenuId, by: OpenedBy) => {
      clearTimer();
      openedBy.current = by;
      setOpenId(id);
    },
    [clearTimer]
  );

  const scheduleClose = useCallback(() => {
    clearTimer();
    closeTimer.current = window.setTimeout(() => {
      if (openedBy.current === 'hover') setOpenId(null);
    }, CLOSE_DELAY_MS);
  }, [clearTimer]);

  const closeNow = useCallback(() => {
    clearTimer();
    setOpenId(null);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  // Escape + clic fuera (desktop)
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const id = openId;
      setOpenId(null);
      const trigger = document.getElementById(`site-trg-${id}`);
      if (trigger && document.activeElement !== trigger) {
        suppressFocusOpen.current = true;
        trigger.focus();
        suppressFocusOpen.current = false;
      }
    };
    const onDown = (e: globalThis.MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [openId]);

  // Móvil: Escape, bloqueo de scroll, re-medición y paso a desktop
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        burgerRef.current?.focus();
      }
    };
    const measure = () => {
      if (headerRef.current) setPanelTop(headerRef.current.getBoundingClientRect().bottom);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', measure);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', measure);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_NAV_MIN_WIDTH}px)`);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleMobile = () => {
    if (!mobileOpen && headerRef.current) {
      setPanelTop(headerRef.current.getBoundingClientRect().bottom);
    }
    closeNow();
    setMobileGroup(null);
    setMobileOpen((v) => !v);
  };

  // Cierra si el clic fue en un enlace que navega (los pendientes no cierran)
  const closeOnNavigate = (e: MouseEvent<HTMLElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor || anchor.hasAttribute('data-pending')) return;
    closeNow();
    setMobileOpen(false);
  };

  // Foco atrapado dentro del header + panel mientras el menú móvil está abierto
  const trapFocus = (e: KeyboardEvent<HTMLElement>) => {
    if (!mobileOpen || e.key !== 'Tab' || !headerRef.current) return;
    const items = Array.from(headerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) =>
        el.getClientRects().length > 0 &&
        !el.closest('[inert]') &&
        getComputedStyle(el).visibility !== 'hidden'
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const triggerProps = (id: MenuId) => ({
    id: `site-trg-${id}`,
    type: 'button' as const,
    className: cx(styles.trigger, openId === id && styles.triggerOpen),
    'aria-expanded': openId === id,
    'aria-controls': `site-panel-${id}`,
    'aria-haspopup': 'true' as const,
    onClick: () => {
      if (openId === id && openedBy.current !== 'hover') closeNow();
      else openMenu(id, 'click');
    },
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      if (suppressFocusOpen.current) return;
      if (openId !== id && e.currentTarget.matches(':focus-visible')) openMenu(id, 'focus');
    },
  });

  const itemProps = (id: MenuId) => ({
    className: cx(styles.item, id === 'solutions' && styles.itemMega),
    onMouseEnter: () => openMenu(id, 'hover'),
    onMouseLeave: scheduleClose,
    onBlur: (e: React.FocusEvent<HTMLLIElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null) && openedBy.current !== 'hover') {
        setOpenId(null);
      }
    },
  });

  const panelClass = (id: MenuId, mega = false) =>
    cx(styles.panel, mega ? styles.mega : styles.drop, openId === id && styles.panelOpen);

  const renderDrop = (id: MenuId, items: DropItem[]) => (
    <div id={`site-panel-${id}`} className={panelClass(id)}>
      {items.map((item) => (
        <SiteLink key={item.key} to={item.key} className={styles.dropLink}>
          <span className={styles.dropTitle}>{t(`site.menu.${item.key}.title`)}</span>
          <span className={styles.dropDesc}>{t(`site.menu.${item.key}.desc`)}</span>
        </SiteLink>
      ))}
    </div>
  );

  const renderIconItems = (items: IconItem[], iconSize: number) =>
    items.map(({ key, icon: Icon }) => (
      <SiteLink key={key} to={key} className={styles.megaLink}>
        <span className={styles.megaIcon}>
          <Icon size={iconSize} aria-hidden="true" />
        </span>
        <span className={styles.megaName}>{t(`site.mega.${key}`)}</span>
      </SiteLink>
    ));

  const mobileGroupBlock = (id: MenuId, label: string, children: React.ReactNode) => {
    const isOpen = mobileGroup === id;
    return (
      <div className={styles.mGroup}>
        <button
          type="button"
          id={`site-mtrg-${id}`}
          className={styles.mGroupBtn}
          aria-expanded={isOpen}
          aria-controls={`site-mbody-${id}`}
          onClick={() => setMobileGroup(isOpen ? null : id)}
        >
          {label}
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={cx(styles.chevron, isOpen && styles.chevronOpen)}
          />
        </button>
        <div
          id={`site-mbody-${id}`}
          className={cx(styles.mBody, isOpen && styles.mBodyOpen)}
          inert={!isOpen}
        >
          <div className={styles.mBodyInner}>{children}</div>
        </div>
      </div>
    );
  };

  const mobileDrop = (items: DropItem[]) =>
    items.map((item) => (
      <SiteLink key={item.key} to={item.key} className={styles.mLink}>
        {t(`site.menu.${item.key}.title`)}
      </SiteLink>
    ));

  const chevron = (id: MenuId) => (
    <ChevronDown
      size={12}
      aria-hidden="true"
      className={cx(styles.chevron, openId === id && styles.chevronOpen)}
    />
  );

  return (
    <>
      <header ref={headerRef} className={styles.header} onKeyDown={trapFocus}>
        <Container className={styles.inner}>
          <SiteLink to="home" className={styles.logo} aria-label={t('site.a11y.home')}>
            <Image
              src="/site/img/logo-gensmart-inv.svg"
              alt="GenSmart"
              width={170}
              height={47}
              priority
              unoptimized
              className={styles.logoImg}
            />
          </SiteLink>

          <nav
            ref={navRef}
            className={styles.nav}
            aria-label={t('site.a11y.mainNav')}
            onClick={closeOnNavigate}
          >
            <ul className={styles.list}>
              <li {...itemProps('product')}>
                <button {...triggerProps('product')}>
                  {t('site.nav.product')}
                  {chevron('product')}
                </button>
                {renderDrop('product', PRODUCT_ITEMS)}
              </li>

              <li {...itemProps('solutions')}>
                <button {...triggerProps('solutions')}>
                  {t('site.nav.solutions')}
                  {chevron('solutions')}
                </button>
                <div id="site-panel-solutions" className={panelClass('solutions', true)}>
                  <div className={styles.megaCol}>
                    <h3 className={styles.megaTitle}>{t('site.mega.byTeam')}</h3>
                    {renderIconItems(TEAM_ITEMS, 16)}
                  </div>
                  <div className={styles.megaCol}>
                    <h3 className={styles.megaTitle}>{t('site.mega.byIndustry')}</h3>
                    {renderIconItems(INDUSTRY_ITEMS, 16)}
                    <SiteLink to="industries" className={styles.megaAll}>
                      {t('site.mega.allIndustries')}
                    </SiteLink>
                  </div>
                  <div className={styles.megaCol}>
                    <h3 className={styles.megaTitle}>{t('site.mega.byPlatform')}</h3>
                    <div className={styles.logos}>
                      {PLATFORM_LOGOS.map((logo) => (
                        <LogoTile key={logo.name} logo={logo} size="sm" />
                      ))}
                    </div>
                    <SiteLink to="integrations" className={styles.megaAll}>
                      {t('site.mega.allIntegrations')}
                    </SiteLink>
                  </div>
                  <SiteLink to="pricing" className={styles.feat}>
                    <span className={styles.featPill}>{t('site.mega.featPill')}</span>
                    <span className={styles.featTitle}>{t('site.mega.featTitle')}</span>
                    <span className={styles.featList}>
                      <span>{t('site.mega.feat1')}</span>
                      <span>{t('site.mega.feat2')}</span>
                      <span>{t('site.mega.feat3')}</span>
                    </span>
                    <span className={styles.featMore}>{t('site.mega.featMore')}</span>
                  </SiteLink>
                </div>
              </li>

              <li
                className={styles.item}
                onMouseEnter={scheduleClose}
                onFocus={closeNow}
              >
                <SiteLink to="pricing" className={styles.trigger}>
                  {t('site.nav.pricing')}
                </SiteLink>
              </li>

              <li {...itemProps('resources')}>
                <button {...triggerProps('resources')}>
                  {t('site.nav.resources')}
                  {chevron('resources')}
                </button>
                {renderDrop('resources', RESOURCES_ITEMS)}
              </li>

              <li {...itemProps('partners')}>
                <button {...triggerProps('partners')}>
                  {t('site.nav.partners')}
                  {chevron('partners')}
                </button>
                {renderDrop('partners', PARTNERS_ITEMS)}
              </li>
            </ul>
          </nav>

          <div className={styles.right}>
            <div className={styles.lang} role="group" aria-label={t('site.a11y.language')}>
              {(['es', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  className={cx(styles.langBtn, language === code && styles.langActive)}
                  aria-pressed={language === code}
                  onClick={() => setLanguage(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <span className={styles.loginWrap}>
              <SiteButton to="login" variant="ghost" size="sm">
                {t('site.nav.login')}
              </SiteButton>
            </span>
            <span className={styles.trialWrap}>
              <SiteButton to="register" size="sm">
                {t('site.nav.trial')}
              </SiteButton>
            </span>
            <button
              ref={burgerRef}
              type="button"
              className={styles.burger}
              aria-label={mobileOpen ? t('site.a11y.closeMenu') : t('site.a11y.openMenu')}
              aria-expanded={mobileOpen}
              aria-controls="site-mobile-panel"
              onClick={toggleMobile}
            >
              {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </Container>

        <div
          id="site-mobile-panel"
          className={cx(styles.mPanel, mobileOpen && styles.mPanelOpen)}
          style={{ top: panelTop }}
          inert={!mobileOpen}
          aria-label={t('site.a11y.mobileNav')}
          onClick={closeOnNavigate}
        >
          {mobileGroupBlock('product', t('site.nav.product'), mobileDrop(PRODUCT_ITEMS))}
          {mobileGroupBlock(
            'solutions',
            t('site.nav.solutions'),
            <>
              <h3 className={styles.mSub}>{t('site.mega.byTeam')}</h3>
              {renderIconItems(TEAM_ITEMS, 16)}
              <h3 className={styles.mSub}>{t('site.mega.byIndustry')}</h3>
              {renderIconItems(INDUSTRY_ITEMS, 16)}
              <SiteLink to="industries" className={styles.megaAll}>
                {t('site.mega.allIndustries')}
              </SiteLink>
            </>
          )}
          <SiteLink to="pricing" className={styles.mDirect}>
            {t('site.nav.pricing')}
          </SiteLink>
          {mobileGroupBlock('resources', t('site.nav.resources'), mobileDrop(RESOURCES_ITEMS))}
          {mobileGroupBlock('partners', t('site.nav.partners'), mobileDrop(PARTNERS_ITEMS))}
          <div className={styles.mActions}>
            <SiteButton to="register" className={styles.fullBtn}>
              {t('site.nav.trial')}
            </SiteButton>
            <SiteButton to="login" variant="ghost" className={styles.fullBtn}>
              {t('site.nav.login')}
            </SiteButton>
          </div>
        </div>
      </header>
    </>
  );
}

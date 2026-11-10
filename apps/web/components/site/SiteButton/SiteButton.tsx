import SiteLink, { type SiteLinkProps } from '../SiteLink';
import styles from './SiteButton.module.css';

type SiteButtonProps = SiteLinkProps & {
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'sm' | 'lg';
};

export default function SiteButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: SiteButtonProps) {
  const classes = [styles.button, styles[variant], size === 'md' ? '' : styles[size], className]
    .filter(Boolean)
    .join(' ');
  return (
    <SiteLink {...rest} className={classes}>
      {children}
    </SiteLink>
  );
}

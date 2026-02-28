import Link from 'next/link';
import styles from './Logo.module.css';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon';
  color?: 'primary' | 'dark' | 'white';
  href?: string;
  className?: string;
}

export function Logo({
  size = 'md',
  variant = 'full',
  color = 'primary',
  href = '/',
  className,
}: LogoProps) {
  const sizeClass = styles[size];
  const fullText = variant === 'full';
  const prefix = fullText ? 'Gen' : 'G';
  const suffix = fullText ? 'Smart' : 'S';

  const renderText = () => {
    if (color === 'primary') {
      return (
        <>
          <span className={styles.primaryGen}>{prefix}</span>
          <span className={styles.primarySmart}>{suffix}</span>
        </>
      );
    }

    const textClass = color === 'dark' ? styles.darkText : styles.whiteText;
    return <span className={textClass}>{prefix}{suffix}</span>;
  };

  return (
    <Link
      href={href}
      className={`${styles.logo} ${sizeClass}${className ? ` ${className}` : ''}`}
    >
      {renderText()}
    </Link>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Building2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import styles from '../auth.module.css';

function validateForm(
  name: string,
  email: string,
  orgName: string,
  password: string,
  confirmPassword: string
): string {
  if (!name.trim() || name.length < 2) return 'Name must be at least 2 characters.';
  if (!email.includes('@')) return 'Please enter a valid email address.';
  if (!orgName.trim() || orgName.length < 2) return 'Organization name must be at least 2 characters.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return '';
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateForm(name, email, orgName, password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email, password, name, orgName);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoCenter}>
        <Logo size="lg" href="/" />
      </div>

      <h1 className={styles.heading}>Create your account</h1>
      <p className={styles.subheading}>Start building AI agents for your business in minutes.</p>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="Full Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          autoComplete="name"
          autoFocus
          required
          icon={User}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          icon={Mail}
        />
        <Input
          label="Company / Organization Name"
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Acme Corp"
          autoComplete="organization"
          required
          icon={Building2}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          autoComplete="new-password"
          required
          icon={Lock}
        />
        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          icon={Lock}
        />
        <Button type="submit" fullWidth loading={loading}>
          Create Account
        </Button>
      </form>

      <p className={styles.footer}>
        Already have an account?{' '}
        <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import styles from '../admin.module.css';

interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  agentsCount: number;
  usersCount: number;
  messagesUsed: number;
  createdAt: string;
}

interface OrgListResponse {
  organizations: OrgListItem[];
  total: number;
  page: number;
  limit: number;
}

const PLAN_BADGE: Record<string, string> = {
  free: 'badgeFree',
  starter: 'badgeStarter',
  pro: 'badgePro',
  enterprise: 'badgeEnterprise',
};

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const loadOrgs = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (q) params.set('search', q);
      const data = await api.get<OrgListResponse>(`/api/admin/organizations?${params}`);
      setOrgs(data.organizations);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs(page, search);
  }, [page, search, loadOrgs]);

  const totalPages = Math.ceil(total / limit);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Organizations</h1>
        <p className={styles.pageDesc}>{total} total organizations</p>
      </div>

      <form className={styles.searchBar} onSubmit={handleSearch}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }}
          />
          <input
            className={styles.searchInput}
            style={{ paddingLeft: '2rem' }}
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </form>

      <div className={styles.card}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner size="md" />
          </div>
        ) : orgs.length === 0 ? (
          <p className={styles.emptyState}>No organizations found</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Plan</th>
                <th>Agents</th>
                <th>Users</th>
                <th>Messages</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  className={styles.clickable}
                  onClick={() => router.push(`/admin/organizations/${org.id}`)}
                >
                  <td>{org.name}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[PLAN_BADGE[org.plan] ?? 'badgeFree']}`}>
                      {org.plan}
                    </span>
                  </td>
                  <td>{org.agentsCount}</td>
                  <td>{org.usersCount}</td>
                  <td>{org.messagesUsed.toLocaleString()}</td>
                  <td>
                    <span className={`${styles.statusDot} ${org.subscriptionStatus === 'active' ? styles.statusDotGreen : styles.statusDotGray}`} />
                    {' '}{org.subscriptionStatus}
                  </td>
                  <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

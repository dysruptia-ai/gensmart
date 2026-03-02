'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, AlertTriangle, Shield, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/formatters';
import styles from './data.module.css';

interface ExportRequest {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'expired';
  expires_at: string | null;
  created_at: string;
}

interface DeletionRequest {
  id: string;
  status: 'pending' | 'cancelled' | 'completed';
  scheduled_at: string;
  reason: string | null;
}

const DELETION_REASONS = [
  { value: 'tooExpensive', label: 'settings.data.deleteAccount.reasons.tooExpensive' },
  { value: 'notUseful', label: 'settings.data.deleteAccount.reasons.notUseful' },
  { value: 'switchingProvider', label: 'settings.data.deleteAccount.reasons.switchingProvider' },
  { value: 'other', label: 'settings.data.deleteAccount.reasons.other' },
];

export default function DataSettingsPage() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { success, error: toastError } = useToast();

  // Export state
  const [exportReq, setExportReq] = useState<ExportRequest | null>(null);
  const [exportLoading, setExportLoading] = useState(true);
  const [requestingExport, setRequestingExport] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Deletion state
  const [deletionReq, setDeletionReq] = useState<DeletionRequest | null>(null);
  const [deletionLoading, setDeletionLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImmediateModal, setShowImmediateModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteReasonText, setDeleteReasonText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadExportStatus = useCallback(async () => {
    try {
      const data = await api.get<ExportRequest | null>('/api/account/export-data/latest');
      setExportReq(data);
    } catch {
      // Ignore
    }
  }, []);

  const loadDeletionStatus = useCallback(async () => {
    try {
      const data = await api.get<DeletionRequest | null>('/api/account/delete/status');
      setDeletionReq(data);
    } catch {
      // Ignore
    } finally {
      setDeletionLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadExportStatus(), loadDeletionStatus()]).finally(() =>
      setExportLoading(false)
    );
  }, [loadExportStatus, loadDeletionStatus]);

  // Poll when export is processing
  useEffect(() => {
    const isActive = exportReq?.status === 'queued' || exportReq?.status === 'processing';

    if (isActive && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(() => {
        void loadExportStatus();
      }, 5000);
    } else if (!isActive && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [exportReq?.status, loadExportStatus]);

  async function handleRequestExport() {
    setRequestingExport(true);
    try {
      const data = await api.post<ExportRequest>('/api/account/export-data');
      setExportReq(data);
      success('Export started — you will be notified when it is ready');
    } catch (err) {
      if (err instanceof ApiError && err.message.includes('in progress')) {
        toastError(t('settings.data.export.alreadyQueued'));
      } else {
        toastError(t('settings.data.export.errorRequesting'));
      }
    } finally {
      setRequestingExport(false);
    }
  }

  function handleDownload(id: string) {
    window.location.href = `/api/account/export-data/${id}`;
  }

  async function handleDeleteAccount() {
    if (!deletePassword) return;
    setDeleting(true);
    try {
      const reason = deleteReason === 'other' ? deleteReasonText : deleteReason;
      const data = await api.post<DeletionRequest>('/api/account/delete', {
        password: deletePassword,
        reason: reason || undefined,
      });
      setDeletionReq(data);
      setShowDeleteModal(false);
      setDeletePassword('');
      setDeleteReason('');
      setDeleteReasonText('');
      success('Account deletion scheduled. You have 30 days to cancel.');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to schedule deletion');
    } finally {
      setDeleting(false);
    }
  }

  async function handleCancelDeletion() {
    try {
      await api.post('/api/account/delete/cancel');
      setDeletionReq(null);
      success(t('settings.data.deleteAccount.deletionCancelled'));
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to cancel deletion');
    }
  }

  async function handleImmediateDeletion() {
    if (!deletePassword) return;
    setDeleting(true);
    try {
      await api.post('/api/account/delete/confirm', { password: deletePassword });
      success('Account deleted successfully');
      setShowImmediateModal(false);
      await logout();
      window.location.href = '/';
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to delete account');
      setDeleting(false);
    }
  }

  function getExpiryDays(expiresAt: string | null): number {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('settings.data.title')}</h1>
        <p className={styles.pageDesc}>{t('settings.data.description')}</p>
      </div>

      {/* Export Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Download size={20} className={styles.sectionIcon} />
          <div>
            <h2 className={styles.sectionTitle}>{t('settings.data.export.title')}</h2>
            <p className={styles.sectionDesc}>{t('settings.data.export.description')}</p>
          </div>
        </div>

        <div className={styles.sectionBody}>
          {exportLoading ? (
            <div className={styles.loadingState}>
              <Loader2 size={20} className={styles.spinner} />
            </div>
          ) : exportReq?.status === 'queued' || exportReq?.status === 'processing' ? (
            <div className={styles.processingState}>
              <Loader2 size={20} className={styles.spinner} />
              <div>
                <p className={styles.processingTitle}>{t('settings.data.export.processing')}</p>
                <p className={styles.processingSubtitle}>{t('settings.data.export.processingSubtitle')}</p>
              </div>
            </div>
          ) : exportReq?.status === 'completed' ? (
            <div className={styles.readyState}>
              <div className={styles.readyBadge}>
                <Shield size={16} />
                {t('settings.data.export.ready')}
              </div>
              <div className={styles.readyActions}>
                <Button variant="primary" onClick={() => handleDownload(exportReq.id)}>
                  <Download size={16} />
                  {t('settings.data.export.download')}
                </Button>
                <Button variant="secondary" onClick={handleRequestExport} loading={requestingExport}>
                  {t('settings.data.export.requestNew')}
                </Button>
              </div>
              <p className={styles.expiry}>
                {t('settings.data.export.expiresIn', { days: getExpiryDays(exportReq.expires_at) })}
              </p>
            </div>
          ) : exportReq?.status === 'failed' ? (
            <div className={styles.failedState}>
              <p className={styles.failedText}>Export failed. Please try again.</p>
              <Button variant="primary" onClick={handleRequestExport} loading={requestingExport}>
                {t('settings.data.export.request')}
              </Button>
            </div>
          ) : (
            <div className={styles.defaultState}>
              {isAdmin ? (
                <Button variant="primary" onClick={handleRequestExport} loading={requestingExport}>
                  {requestingExport ? t('settings.data.export.requesting') : t('settings.data.export.request')}
                </Button>
              ) : (
                <p className={styles.adminOnly}>Only admins and owners can request data exports.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Delete Account Section */}
      <section className={`${styles.section} ${styles.dangerSection}`}>
        <div className={styles.sectionHeader}>
          <AlertTriangle size={20} className={styles.dangerIcon} />
          <div>
            <h2 className={styles.sectionTitle}>{t('settings.data.deleteAccount.title')}</h2>
            <p className={styles.sectionDesc}>{t('settings.data.deleteAccount.description')}</p>
          </div>
        </div>

        <div className={styles.sectionBody}>
          <div className={styles.warningList}>
            <p className={styles.warningTitle}>{t('settings.data.deleteAccount.warning')}</p>
            <ul>
              <li>{t('settings.data.deleteAccount.warningItems.org')}</li>
              <li>{t('settings.data.deleteAccount.warningItems.agents')}</li>
              <li>{t('settings.data.deleteAccount.warningItems.conversations')}</li>
              <li>{t('settings.data.deleteAccount.warningItems.contacts')}</li>
              <li>{t('settings.data.deleteAccount.warningItems.subscription')}</li>
            </ul>
          </div>

          {deletionLoading ? (
            <div className={styles.loadingState}>
              <Loader2 size={20} className={styles.spinner} />
            </div>
          ) : deletionReq ? (
            <div className={styles.scheduledState}>
              <AlertTriangle size={18} className={styles.dangerIcon} />
              <div>
                <p className={styles.scheduledText}>
                  {t('settings.data.deleteAccount.scheduledFor', {
                    date: formatDate(deletionReq.scheduled_at, language),
                  })}
                </p>
                <p className={styles.gracePeriodText}>{t('settings.data.deleteAccount.gracePeriod')}</p>
              </div>
              <div className={styles.scheduledActions}>
                <Button variant="secondary" onClick={handleCancelDeletion}>
                  {t('settings.data.deleteAccount.cancelDeletion')}
                </Button>
                {isAdmin && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDeletePassword('');
                      setShowImmediateModal(true);
                    }}
                  >
                    {t('settings.data.deleteAccount.confirmImmediately')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.deleteActions}>
              <p className={styles.gracePeriodNote}>{t('settings.data.deleteAccount.gracePeriod')}</p>
              {isAdmin ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeletePassword('');
                    setDeleteReason('');
                    setDeleteReasonText('');
                    setShowDeleteModal(true);
                  }}
                >
                  {t('settings.data.deleteAccount.confirmButton')}
                </Button>
              ) : (
                <p className={styles.adminOnly}>Only owners can delete the organization account.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Delete Account Modal (30-day grace) */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('settings.data.deleteAccount.deleteModal.title')}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalWarning}>
            <AlertTriangle size={16} />
            <p>{t('settings.data.deleteAccount.deleteModal.warning')}</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.data.deleteAccount.reason')}</label>
            <select
              className={styles.select}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            >
              <option value="">— {t('common.optional')} —</option>
              {DELETION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{t(r.label)}</option>
              ))}
            </select>
          </div>

          {deleteReason === 'other' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>{t('settings.data.deleteAccount.reasonPlaceholder')}</label>
              <textarea
                className={styles.textarea}
                value={deleteReasonText}
                onChange={(e) => setDeleteReasonText(e.target.value)}
                placeholder={t('settings.data.deleteAccount.reasonPlaceholder')}
                rows={3}
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.data.deleteAccount.enterPassword')}</label>
            <input
              type="password"
              className={styles.input}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              {t('settings.data.deleteAccount.deleteModal.cancelButton')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={deleting}
              disabled={!deletePassword}
            >
              {deleting ? t('settings.data.deleteAccount.deleting') : t('settings.data.deleteAccount.deleteModal.confirmButton')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Immediate Deletion Modal */}
      <Modal
        isOpen={showImmediateModal}
        onClose={() => setShowImmediateModal(false)}
        title={t('settings.data.deleteAccount.deleteModal.immediateTitle')}
      >
        <div className={styles.modalContent}>
          <div className={`${styles.modalWarning} ${styles.modalWarningDanger}`}>
            <AlertTriangle size={16} />
            <p>{t('settings.data.deleteAccount.confirmImmediatelyWarning')}</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.data.deleteAccount.enterPassword')}</label>
            <input
              type="password"
              className={styles.input}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setShowImmediateModal(false)}>
              {t('settings.data.deleteAccount.deleteModal.cancelButton')}
            </Button>
            <Button
              variant="danger"
              onClick={handleImmediateDeletion}
              loading={deleting}
              disabled={!deletePassword}
            >
              {deleting ? t('settings.data.deleteAccount.deleting') : t('settings.data.deleteAccount.deleteModal.confirmImmediateButton')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

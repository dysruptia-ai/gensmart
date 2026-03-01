'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import styles from './AppointmentModal.module.css';
import type { Appointment } from './CalendarView';

interface Calendar {
  id: string;
  name: string;
  slot_duration: number;
  timezone?: string;
}

/**
 * Converts a wall-clock date+time in `timezone` to a UTC ISO string.
 * Uses Date.UTC() + Intl.DateTimeFormat.formatToParts() so it is
 * independent of both the server's and the browser's local timezone.
 */
function localDateTimeToUTC(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];

  const utcAnchor = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcAnchor);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0');

  const tzHour = get('hour') === 24 ? 0 : get('hour');
  const tzAsUTC = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), tzHour, get('minute'), 0));
  const offsetMs = utcAnchor.getTime() - tzAsUTC.getTime();

  return new Date(utcAnchor.getTime() + offsetMs).toISOString();
}

interface TimeSlot {
  start: string;
  end: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  defaultDate?: string; // YYYY-MM-DD
  calendars: Calendar[];
  onSaved: () => void;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  appointment,
  defaultDate,
  calendars,
  onSaved,
}: Props) {
  const toast = useToast();
  const isEditing = Boolean(appointment);

  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  // Populate form from existing appointment or defaults
  useEffect(() => {
    if (!isOpen) return;
    if (appointment) {
      setTitle(appointment.title);
      setDescription('');
      setStatus(appointment.status);
      const apptTz = appointment.calendar_timezone || 'UTC';
      const d = new Date(appointment.start_time);
      // Show date and time in the calendar's timezone, not UTC
      const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: apptTz }).format(d);
      const localTime = d.toLocaleTimeString('en-GB', {
        timeZone: apptTz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      setDate(localDate);
      setTimeSlot(localTime.slice(0, 5));
      setCalendarId('');
    } else {
      setTitle('');
      setDescription('');
      setStatus('scheduled');
      setDate(defaultDate ?? '');
      setTimeSlot('');
      setCalendarId(calendars[0]?.id ?? '');
    }
    setSlots([]);
  }, [isOpen, appointment, defaultDate, calendars]);

  // Fetch slots when calendar + date change
  useEffect(() => {
    if (!calendarId || !date || isEditing) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    setLoadingSlots(true);
    setSlots([]);
    setTimeSlot('');

    api
      .get<{ slots: TimeSlot[] }>(
        `/api/appointments/available-slots?calendar_id=${calendarId}&date=${date}`
      )
      .then((data) => {
        setSlots(data.slots);
        if (data.slots[0]) setTimeSlot(data.slots[0].start);
      })
      .catch(() => toast.error('Could not load available slots'))
      .finally(() => setLoadingSlots(false));
  }, [calendarId, date, isEditing, toast]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!isEditing && (!calendarId || !date || !timeSlot)) {
      toast.error('Calendar, date and time are required');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && appointment) {
        await api.put(`/api/appointments/${appointment.id}`, {
          title,
          description: description || null,
          status,
        });
        toast.success('Appointment updated');
      } else {
        // Calculate end time using slot duration; convert local slot time → UTC
        const cal = calendars.find((c) => c.id === calendarId);
        const slotDuration = cal?.slot_duration ?? 30;
        const calTz = cal?.timezone || 'UTC';
        const startISO = localDateTimeToUTC(date, timeSlot, calTz);
        const endISO = new Date(new Date(startISO).getTime() + slotDuration * 60000).toISOString();

        await api.post('/api/appointments', {
          calendarId,
          title,
          description: description || null,
          startTime: startISO,
          endTime: endISO,
        });
        toast.success('Appointment booked');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!appointment) return;
    setSaving(true);
    try {
      await api.delete(`/api/appointments/${appointment.id}`);
      toast.success('Appointment cancelled');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to cancel appointment');
    } finally {
      setSaving(false);
    }
  };

  const getStatusClass = () => {
    if (status === 'completed') return styles.statusCompleted;
    if (status === 'cancelled') return styles.statusCancelled;
    return styles.statusScheduled;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Appointment' : 'New Appointment'}
      size="md"
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Consultation call"
          />
        </div>

        {!isEditing && (
          <div className={styles.field}>
            <label className={styles.label}>Calendar</label>
            <select
              className={styles.select}
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isEditing}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Time</label>
            {isEditing ? (
              <Input value={timeSlot} disabled />
            ) : loadingSlots ? (
              <div className={styles.slotsLoading}>Loading slots…</div>
            ) : slots.length === 0 && date ? (
              <div className={styles.noSlots}>No slots available</div>
            ) : (
              <select
                className={styles.select}
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
              >
                {slots.map((s) => (
                  <option key={s.start} value={s.start}>
                    {s.start}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description (optional)</label>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details…"
          />
        </div>

        {isEditing && (
          <div className={styles.field}>
            <label className={styles.label}>Status</label>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}

        {isEditing && (
          <div>
            <span className={`${styles.statusBadge} ${getStatusClass()}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <div>
          {isEditing && appointment?.status !== 'cancelled' && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              loading={saving}
            >
              Cancel Appointment
            </Button>
          )}
        </div>
        <div className={styles.footerRight}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {isEditing ? 'Save Changes' : 'Book Appointment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

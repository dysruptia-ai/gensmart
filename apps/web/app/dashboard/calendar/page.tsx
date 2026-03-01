'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import CalendarView, {
  type Appointment,
  getDayInTimezone,
  getMonthInTimezone,
  getYearInTimezone,
} from '@/components/calendar/CalendarView';
import DayDetail from '@/components/calendar/DayDetail';
import AppointmentModal from '@/components/calendar/AppointmentModal';
import styles from './calendar.module.css';

interface Calendar {
  id: string;
  name: string;
  slot_duration: number;
  agent_id: string | null;
  timezone?: string;
}

interface Agent {
  id: string;
  name: string;
}

export default function CalendarPage() {
  const toast = useToast();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterCalendar, setFilterCalendar] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [newApptDate, setNewApptDate] = useState('');

  const fetchCalendars = useCallback(async () => {
    const res = await api.get<{ calendars: Calendar[] }>('/api/calendars');
    setCalendars(res.calendars);
  }, []);

  const fetchAppointments = useCallback(async () => {
    // Fetch full month range
    const fromDate = new Date(year, month, 1).toISOString();
    const toDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const params = new URLSearchParams({
      from_date: fromDate,
      to_date: toDate,
    });
    if (filterCalendar) params.set('calendar_id', filterCalendar);
    if (filterStatus) params.set('status', filterStatus);

    const res = await api.get<{ appointments: Appointment[] }>(
      `/api/appointments?${params.toString()}`
    );
    setAppointments(res.appointments);
  }, [year, month, filterCalendar, filterStatus]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchCalendars(), fetchAppointments()]);
      const agentsRes = await api.get<{ agents: Agent[] }>('/api/agents');
      setAgents(agentsRes.agents ?? []);
    } catch {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [fetchCalendars, fetchAppointments, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  const selectedDayStr = useMemo(() => {
    if (!selectedDay) return '';
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(selectedDay).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }, [year, month, selectedDay]);

  const dayAppointments = useMemo(() => {
    if (!selectedDay) return [];
    return appointments.filter((a) => {
      const tz = a.calendar_timezone || 'UTC';
      return (
        getYearInTimezone(a.start_time, tz) === year &&
        getMonthInTimezone(a.start_time, tz) === month &&
        getDayInTimezone(a.start_time, tz) === selectedDay
      );
    });
  }, [appointments, year, month, selectedDay]);

  const openNewAppointment = (date?: string) => {
    setEditingAppointment(null);
    setNewApptDate(date ?? selectedDayStr);
    setModalOpen(true);
  };

  const openEditAppointment = (a: Appointment) => {
    setEditingAppointment(a);
    setNewApptDate('');
    setModalOpen(true);
  };

  void agents; // used for future agent filter

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Calendar</h1>
        <div className={styles.filters}>
          <select
            className={styles.select}
            value={filterCalendar}
            onChange={(e) => setFilterCalendar(e.target.value)}
          >
            <option value="">All Calendars</option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className={styles.select}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openNewAppointment()}
            disabled={calendars.length === 0}
          >
            New Appointment
          </Button>
        </div>
      </div>

      <div className={styles.layout}>
        <CalendarView
          year={year}
          month={month}
          appointments={appointments}
          selectedDay={selectedDay}
          onDaySelect={setSelectedDay}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />

        {selectedDay && (
          <DayDetail
            date={selectedDayStr}
            appointments={dayAppointments}
            onNewAppointment={() => openNewAppointment(selectedDayStr)}
            onSelectAppointment={openEditAppointment}
          />
        )}
      </div>

      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={editingAppointment}
        defaultDate={newApptDate}
        calendars={calendars}
        onSaved={fetchAppointments}
      />
    </div>
  );
}

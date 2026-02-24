'use client';

import React, { useState } from 'react';
import {
  Button, Input, Modal, Card, Badge, Table, Dropdown,
  ToastProvider, useToast, Tabs, Avatar, Spinner, EmptyState,
  SearchInput, ProgressBar, Toggle, Tooltip, Skeleton, ColorPicker,
} from '@/components/ui';
import {
  Plus, Trash2, Edit, Download, Settings, Bell, Users,
  MessageSquare, BarChart2, Package, Inbox,
} from 'lucide-react';

function DesignSystemInner() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [toggleChecked, setToggleChecked] = useState(false);
  const [color, setColor] = useState('#25D366');
  const [searchValue, setSearchValue] = useState('');

  const tableData = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'Member', status: 'inactive' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'Owner', status: 'active' },
  ] as const;

  type TableRow = { id: string; name: string; email: string; role: string; status: string };

  const tableColumns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    {
      key: 'status',
      label: 'Status',
      render: (row: TableRow) => (
        <Badge variant={row.status === 'active' ? 'success' : 'neutral'} dot>
          {row.status}
        </Badge>
      ),
    },
  ] as { key: string; label: string; render?: (row: TableRow) => React.ReactNode }[];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: 'var(--font-3xl)', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
        GenSmart Design System
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '3rem' }}>
        All UI components with variants. Phase 0.3 verification.
      </p>

      {/* ===== BUTTONS ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Buttons</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
          <Button size="sm" icon={Plus}>Small</Button>
          <Button size="md" icon={Plus}>Medium</Button>
          <Button size="lg" icon={Plus}>Large</Button>
        </div>
        <Button variant="primary" fullWidth icon={Download}>Full Width Button</Button>
      </section>

      {/* ===== INPUTS ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Inputs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <Input label="Name" placeholder="Enter your name" />
          <Input label="Email" type="email" icon={Bell} placeholder="your@email.com" hint="We'll never share your email" />
          <Input label="Password" type="password" placeholder="Min 8 characters" />
          <Input label="Error State" error="This field is required" placeholder="Invalid input" />
          <Input label="Disabled" disabled value="Cannot edit" />
        </div>
      </section>

      {/* ===== BADGES ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Badges</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <Badge variant="success">Active</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="danger">Error</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="success" dot>Online</Badge>
          <Badge variant="danger" dot size="sm">Offline</Badge>
        </div>
      </section>

      {/* ===== CARDS ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Cards</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <Card padding="sm"><p>Small padding card</p></Card>
          <Card padding="md"><p>Medium padding card</p></Card>
          <Card padding="lg"><p>Large padding card</p></Card>
          <Card hoverable onClick={() => toast.info('Card clicked!')}><p>Hoverable card — click me</p></Card>
        </div>
      </section>

      {/* ===== AVATAR ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Avatar</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <Avatar name="John Doe" size="sm" />
          <Avatar name="Jane Smith" size="md" />
          <Avatar name="Bob Johnson" size="lg" />
          <Avatar name="Alice Williams" size="xl" />
          <Avatar size="md" />
        </div>
      </section>

      {/* ===== TABS ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Tabs</h2>
        <Tabs
          tabs={[
            { id: 'overview', label: 'Overview', icon: BarChart2 },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'messages', label: 'Messages', icon: MessageSquare },
            { id: 'settings', label: 'Settings', icon: Settings },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        >
          <Card padding="md">
            <p style={{ color: 'var(--color-text-secondary)' }}>Active tab: <strong>{activeTab}</strong></p>
          </Card>
        </Tabs>
      </section>

      {/* ===== TABLE ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Table</h2>
        <div style={{ marginBottom: '1rem' }}>
          <Table
            columns={tableColumns}
            data={[...tableData]}
            onRowClick={(row) => toast.info(`Clicked: ${row.name}`)}
          />
        </div>
        <Table columns={tableColumns} data={[]} emptyMessage="No team members found" />
      </section>

      {/* ===== MODAL ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Example Modal" size="md">
          <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>
            This is a modal dialog. Click outside or press ESC to close.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setModalOpen(false); toast.success('Action confirmed!'); }}>Confirm</Button>
          </div>
        </Modal>
      </section>

      {/* ===== DROPDOWN ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Dropdown</h2>
        <Dropdown
          trigger={<Button variant="secondary" icon={Settings} iconPosition="right">Options</Button>}
          items={[
            { label: 'Edit', icon: Edit, onClick: () => toast.info('Edit clicked') },
            { label: 'Download', icon: Download, onClick: () => toast.info('Download clicked') },
            { label: 'Delete', icon: Trash2, danger: true, dividerBefore: true, onClick: () => toast.error('Delete clicked') },
          ]}
        />
      </section>

      {/* ===== TOAST ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Toast</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Button variant="primary" onClick={() => toast.success('Success!', 'Operation completed')}>Success Toast</Button>
          <Button variant="danger" onClick={() => toast.error('Error!', 'Something went wrong')}>Error Toast</Button>
          <Button variant="secondary" onClick={() => toast.warning('Warning!', 'Check your settings')}>Warning Toast</Button>
          <Button variant="outline" onClick={() => toast.info('Info', 'New update available')}>Info Toast</Button>
        </div>
      </section>

      {/* ===== FEEDBACK ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Spinner & Skeleton</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
          <Spinner size="md" color="var(--color-info)" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <Skeleton variant="circle" width={48} height={48} />
            <div style={{ flex: 1 }}>
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="40%" />
            </div>
          </div>
          <Skeleton variant="rectangle" height={120} />
        </div>
      </section>

      {/* ===== PROGRESS & TOGGLE ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>ProgressBar & Toggle</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', maxWidth: '400px' }}>
          <ProgressBar value={25} label="Storage" showLabel />
          <ProgressBar value={60} label="Messages" showLabel color="var(--color-info)" />
          <ProgressBar value={85} label="Contacts (85%)" showLabel color="var(--color-warning)" />
          <ProgressBar value={100} label="Limit reached" showLabel color="var(--color-danger)" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Toggle checked={toggleChecked} onChange={setToggleChecked} label={`Notifications: ${toggleChecked ? 'On' : 'Off'}`} />
          <Toggle checked={true} onChange={() => undefined} label="Always enabled" disabled />
        </div>
      </section>

      {/* ===== SEARCH & TOOLTIP ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>SearchInput & Tooltip</h2>
        <div style={{ maxWidth: '320px', marginBottom: '1.5rem' }}>
          <SearchInput
            placeholder="Search agents..."
            value={searchValue}
            onChange={setSearchValue}
          />
          {searchValue && <p style={{ marginTop: '0.5rem', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>Searching for: &quot;{searchValue}&quot;</p>}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Tooltip content="This is a tooltip!" position="top">
            <Button variant="outline">Hover for top tooltip</Button>
          </Tooltip>
          <Tooltip content="Bottom tooltip example" position="bottom">
            <Button variant="outline">Bottom tooltip</Button>
          </Tooltip>
          <Tooltip content="Right side tooltip" position="right">
            <Button variant="outline">Right tooltip</Button>
          </Tooltip>
        </div>
      </section>

      {/* ===== EMPTY STATE & COLOR PICKER ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>EmptyState & ColorPicker</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <Card padding="md">
            <EmptyState
              icon={Package}
              title="No agents yet"
              description="Create your first AI agent to start automating conversations."
              action={<Button variant="primary" icon={Plus}>Create Agent</Button>}
            />
          </Card>
          <Card padding="md">
            <ColorPicker
              label="Widget Primary Color"
              value={color}
              onChange={setColor}
            />
            <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: color, color: '#fff', textAlign: 'center' }}>
              Preview: {color}
            </div>
          </Card>
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <EmptyState
            icon={Inbox}
            title="No results found"
            description="Try adjusting your search or filters."
          />
        </div>
      </section>

      {/* ===== COLOR PALETTE ===== */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Color Palette</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {[
            { name: 'Primary', var: '--color-primary' },
            { name: 'Primary Dark', var: '--color-primary-dark' },
            { name: 'Primary Light', var: '--color-primary-light' },
            { name: 'BG Main', var: '--color-bg-main' },
            { name: 'BG Card', var: '--color-bg-card' },
            { name: 'BG Sidebar', var: '--color-bg-sidebar' },
            { name: 'Text Primary', var: '--color-text-primary' },
            { name: 'Text Secondary', var: '--color-text-secondary' },
            { name: 'Border', var: '--color-border' },
            { name: 'Danger', var: '--color-danger' },
            { name: 'Warning', var: '--color-warning' },
            { name: 'Success', var: '--color-success' },
            { name: 'Info', var: '--color-info' },
          ].map((c) => (
            <div key={c.var} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <div style={{ height: '3rem', backgroundColor: `var(${c.var})` }} />
              <div style={{ padding: '0.5rem', background: '#fff' }}>
                <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{c.var}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <ToastProvider>
      <DesignSystemInner />
    </ToastProvider>
  );
}

import { ThemeSwitcher } from '@/components/theme-switcher';
import { Activity, Pill, Users, Wifi } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">M-IMS</h1>
              <p className="text-xs text-muted-foreground">Hospital Medicine Inventory Management</p>
            </div>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-card to-background">
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold mb-4">
            Medicine Inventory Management System
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Multi-tenant hospital inventory system with FIFO allocation, offline-first architecture, 
            and real-time synchronization across facilities.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
              Get Started
            </button>
            <button className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-accent transition-colors font-medium">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">Key Features</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Patient Registration */}
            <div className="p-6 rounded-lg border border-border bg-card hover:bg-accent transition-colors">
              <Users className="h-12 w-12 text-primary mb-4" />
              <h4 className="text-xl font-semibold mb-2">Patient Registration</h4>
              <p className="text-sm text-muted-foreground">
                Register patients with NR-Number generation, ward assignment, and complete medical history.
              </p>
            </div>

            {/* FIFO Allocation */}
            <div className="p-6 rounded-lg border border-border bg-card hover:bg-accent transition-colors">
              <Pill className="h-12 w-12 text-primary mb-4" />
              <h4 className="text-xl font-semibold mb-2">FIFO Allocation</h4>
              <p className="text-sm text-muted-foreground">
                Automated First-In-First-Out medicine allocation with batch tracking and expiry management.
              </p>
            </div>

            {/* Multi-Pharmacy */}
            <div className="p-6 rounded-lg border border-border bg-card hover:bg-accent transition-colors">
              <Activity className="h-12 w-12 text-primary mb-4" />
              <h4 className="text-xl font-semibold mb-2">Multi-Pharmacy</h4>
              <p className="text-sm text-muted-foreground">
                Inter-pharmacy transfers with approval workflows and real-time stock visibility.
              </p>
            </div>

            {/* Offline Sync */}
            <div className="p-6 rounded-lg border border-border bg-card hover:bg-accent transition-colors">
              <Wifi className="h-12 w-12 text-primary mb-4" />
              <h4 className="text-xl font-semibold mb-2">Offline Sync</h4>
              <p className="text-sm text-muted-foreground">
                Offline-first architecture with bidirectional sync and automatic conflict resolution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 bg-card">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">20+</div>
              <div className="text-muted-foreground">Database Entities</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">FIFO</div>
              <div className="text-muted-foreground">Batch Allocation</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
              <div className="text-muted-foreground">Uptime Target</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <div className="text-muted-foreground">Sync Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-card mt-auto">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>M-IMS © 2025 - Hospital Medicine Inventory Management System</p>
          <p className="mt-2">Multi-tenant • Offline-first • FIFO Allocation</p>
        </div>
      </footer>
    </main>
  );
}

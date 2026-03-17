import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Attendance Dashboard | Hospital IMS',
  description:
    'Real-time attendance monitoring and analytics dashboard for hospital staff',
};

export default function AttendanceDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

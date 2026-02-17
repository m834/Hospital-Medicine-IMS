import { ConsultationForm } from '@/components/doctor/ConsultationForm';

interface ConsultPageProps {
  params: Promise<{ visitId: string }>;
}

export default async function ConsultPage({ params }: ConsultPageProps) {
  const { visitId } = await params;
  return <ConsultationForm visitId={visitId} />;
}

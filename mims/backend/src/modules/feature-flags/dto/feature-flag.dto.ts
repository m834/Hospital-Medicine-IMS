export interface FeatureFlagDto {
  id: string;
  hospitalId: string | null;
  key: string;
  enabled: boolean;
  description: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

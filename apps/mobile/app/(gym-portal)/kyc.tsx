import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../../theme/brand';
import { IconArrowLeft, IconCheck, IconClock } from '../../components/Icons';
import { api, gymStaffApi } from '../../lib/api';

interface KycStep {
  id: string;
  title: string;
  description: string;
  status: 'verified' | 'approved' | 'in_review' | 'pending' | 'rejected';
}

const DEFAULT_STEPS: KycStep[] = [
  { id: 'business_registration', title: 'Business Registration', description: 'Legal registration details and document URL', status: 'pending' },
  { id: 'gst_certificate', title: 'GST Certificate', description: 'GST number and certificate URL', status: 'pending' },
  { id: 'identity_document', title: 'Owner Identity Proof', description: 'Owner ID details and document URL', status: 'pending' },
  { id: 'bank_details', title: 'Bank Account Details', description: 'Account, IFSC, bank name, and proof URL', status: 'pending' },
  { id: 'gym_photos', title: 'Gym Photos', description: 'Exterior, interior, and equipment photos', status: 'pending' },
  { id: 'trainer_certs', title: 'Trainer Certificates', description: 'Trainer certificate details and URL', status: 'pending' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  verified: { label: 'Verified', color: colors.accent, bg: 'rgba(0,212,106,0.1)' },
  approved: { label: 'Approved', color: colors.accent, bg: 'rgba(0,212,106,0.1)' },
  in_review: { label: 'In Review', color: 'rgba(255,210,50,0.9)', bg: 'rgba(255,210,50,0.08)' },
  pending: { label: 'Pending', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)' },
  rejected: { label: 'Rejected', color: 'rgba(255,80,80,0.9)', bg: 'rgba(255,60,60,0.08)' },
};

function StepDot({ status }: { status: string }) {
  const isDone = status === 'verified' || status === 'approved';
  const isReview = status === 'in_review';
  return (
    <View style={[
      s.dot,
      isDone ? s.dotDone : isReview ? s.dotReview : s.dotPending,
    ]}>
      {isDone
        ? <IconCheck size={12} color="#000" />
        : <IconClock size={12} color={isReview ? 'rgba(255,210,50,0.9)' : colors.t2} />
      }
    </View>
  );
}

export default function KycTracker() {
  const [steps, setSteps] = useState<KycStep[]>(DEFAULT_STEPS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gymStaffApi.myGym()
      .then(async (gym: any) => {
        const data: any = gym?.id ? await api.get(`/gyms/${gym.id}/kyc`) : null;
        const docs = data?.kycDocuments || [];
        setSteps(DEFAULT_STEPS.map((step) => {
          const doc = docs.find((d: any) => d.type === step.id);
          return doc
            ? { ...step, status: (doc.status || data.kycStatus || 'in_review') as KycStep['status'], description: doc.name || step.description }
            : step;
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const doneCount = steps.filter((s) => s.status === 'verified' || s.status === 'approved').length;
  const progress = steps.length > 0 ? doneCount / steps.length : 0;
  const remaining = steps.length - doneCount;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <IconArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>KYC Tracker</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Progress banner */}
          <View style={s.progressCard}>
            <Text style={s.progressLabel}>
              {remaining === 0 ? 'All steps complete' : `${remaining} of ${steps.length} steps remaining`}
            </Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>

          {/* Steps */}
          {steps.map((step, i) => {
            const meta = STATUS_META[step.status] || STATUS_META.pending;
            return (
              <View key={step.id} style={s.stepRow}>
                <View style={s.stepLeft}>
                  <StepDot status={step.status} />
                  {i < steps.length - 1 && <View style={s.connector} />}
                </View>
                <View style={s.stepBody}>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  <Text style={s.stepDesc}>{step.description}</Text>
                  <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {remaining > 0 && (
            <TouchableOpacity
              style={s.uploadBtn}
              onPress={() =>
                Alert.alert(
                  'Upload Documents',
                  'Please email your KYC documents to kyc@bookmyfit.in or use the web portal at gym.bookmyfit.in to upload directly.',
                  [
                    { text: 'Open Web Portal', onPress: () => Linking.openURL('https://gym.bookmyfit.in/kyc') },
                    { text: 'OK', style: 'cancel' },
                  ],
                )
              }
            >
              <Text style={s.uploadBtnText}>Upload Pending Documents</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  back: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff' },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  progressCard: {
    backgroundColor: 'rgba(0,212,106,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,212,106,0.18)',
    borderRadius: radius.lg, padding: 14, marginBottom: 24,
  },
  progressLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accent, marginBottom: 8 },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  stepRow: { flexDirection: 'row', marginBottom: 8 },
  stepLeft: { width: 36, alignItems: 'center' },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.accent },
  dotReview: { backgroundColor: 'rgba(255,210,50,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,210,50,0.5)' },
  dotPending: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  connector: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 3 },
  stepBody: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  stepTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', marginBottom: 3 },
  stepDesc: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, marginBottom: 8, lineHeight: 17 },
  statusPill: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 0.4 },
  uploadBtn: {
    height: 50, borderRadius: 30, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  uploadBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#000' },
});

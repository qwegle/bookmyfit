'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { CheckCircle, Clock, AlertCircle, Upload, FileText } from 'lucide-react';

const KYC_STEPS = [
  { type: 'business_registration', label: 'Business Registration' },
  { type: 'gst_certificate', label: 'GST Certificate' },
  { type: 'identity_document', label: 'Owner Identity Document' },
  { type: 'bank_details', label: 'Bank Details' },
  { type: 'gym_photos', label: 'Gym Photos' },
  { type: 'trainer_certs', label: 'Trainer Certificates' },
];

const KYC_FIELDS: Record<string, { key: string; label: string; type?: string; required?: boolean }[]> = {
  business_registration: [
    { key: 'legalName', label: 'Legal business name', required: true },
    { key: 'registrationNumber', label: 'Registration number', required: true },
    { key: 'businessType', label: 'Business type', required: true },
    { key: 'documentUrl', label: 'Registration document URL', type: 'url', required: true },
  ],
  gst_certificate: [
    { key: 'gstNumber', label: 'GST number', required: true },
    { key: 'registeredName', label: 'Registered name', required: true },
    { key: 'documentUrl', label: 'GST certificate URL', type: 'url', required: true },
  ],
  identity_document: [
    { key: 'ownerName', label: 'Owner name', required: true },
    { key: 'documentType', label: 'Document type', required: true },
    { key: 'documentNumber', label: 'Document number', required: true },
    { key: 'documentUrl', label: 'Identity document URL', type: 'url', required: true },
  ],
  bank_details: [
    { key: 'accountHolderName', label: 'Account holder name', required: true },
    { key: 'bankName', label: 'Bank name', required: true },
    { key: 'accountNumber', label: 'Account number', required: true },
    { key: 'ifsc', label: 'IFSC code', required: true },
    { key: 'cancelledChequeUrl', label: 'Cancelled cheque/passbook URL', type: 'url', required: true },
  ],
  gym_photos: [
    { key: 'exteriorPhotoUrl', label: 'Exterior photo URL', type: 'url', required: true },
    { key: 'interiorPhotoUrl', label: 'Interior photo URL', type: 'url', required: true },
    { key: 'equipmentPhotoUrl', label: 'Equipment photo URL', type: 'url' },
  ],
  trainer_certs: [
    { key: 'trainerName', label: 'Trainer name', required: true },
    { key: 'certificateName', label: 'Certificate name', required: true },
    { key: 'certificateUrl', label: 'Certificate URL', type: 'url', required: true },
  ],
};

type KycDoc = { name: string; url?: string; type: string; fields?: Record<string, string>; uploadedAt: string; status?: string; reviewNote?: string };
type KycData = { kycStatus: string; kycDocuments: KycDoc[] };

const STATUS_COLORS: Record<string, string> = {
  not_started: 'rgba(255,255,255,0.3)',
  in_review: 'rgba(255,165,0,0.8)',
  approved: 'rgba(61,255,84,0.8)',
  rejected: 'rgba(255,60,60,0.8)',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

function StepBadge({ status }: { status: 'pending' | 'uploaded' | 'approved' | 'rejected' }) {
  if (status === 'approved') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#3DFF54', background: 'rgba(61,255,84,0.1)', border: '1px solid rgba(61,255,84,0.3)', borderRadius: 20, padding: '2px 10px' }}>
      <CheckCircle size={12} /> Approved
    </span>
  );
  if (status === 'uploaded') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#FFA500', background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 20, padding: '2px 10px' }}>
      <Clock size={12} /> In Review
    </span>
  );
  if (status === 'rejected') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#FF3C3C', background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 20, padding: '2px 10px' }}>
      <AlertCircle size={12} /> Rejected
    </span>
  );
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '2px 10px' }}>
      <AlertCircle size={12} /> Pending
    </span>
  );
}

export default function KycPage() {
  const { toast } = useToast();
  const [gymId, setGymId] = useState<string | null>(null);
  const [kycData, setKycData] = useState<KycData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{ type: string; fields: Record<string, string> }>({ type: KYC_STEPS[0].type, fields: {} });

  const fetchKyc = async (id: string) => {
    const data = await api.get<KycData>(`/gyms/${id}/kyc`);
    setKycData(data);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const gym = await api.get<{ id: string }>('/gyms/my-gym');
        if (gym?.id) {
          setGymId(gym.id);
          await fetchKyc(gym.id);
        }
      } catch {
        toast('Failed to load KYC data', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getStepStatus = (type: string): 'pending' | 'uploaded' | 'approved' | 'rejected' => {
    if (!kycData?.kycDocuments?.length) return 'pending';
    const doc = kycData.kycDocuments.find((d) => d.type === type);
    if (!doc) return 'pending';
    if (doc.status === 'approved') return 'approved';
    if (doc.status === 'rejected') return 'rejected';
    return 'uploaded';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gymId) return;
    const schema = KYC_FIELDS[form.type] || [];
    const missing = schema.find((f) => f.required && !String(form.fields[f.key] || '').trim());
    if (missing) {
      toast(`${missing.label} is required`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/gyms/${gymId}/kyc-documents`, {
        type: form.type,
        name: KYC_STEPS.find((s) => s.type === form.type)?.label || 'KYC Submission',
        fields: form.fields,
      });
      await fetchKyc(gymId);
      toast('Document submitted successfully!', 'success');
      setForm({ type: KYC_STEPS[0].type, fields: {} });
    } catch (err: any) {
      toast(err.message || 'Failed to submit document', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadedCount = KYC_STEPS.filter((s) => getStepStatus(s.type) !== 'pending').length;
  const progress = Math.round((uploadedCount / KYC_STEPS.length) * 100);

  return (
    <Shell title="KYC Verification">
      {loading ? (
        <div style={{ color: 'var(--t2)', fontSize: 14 }}>Loading KYC status…</div>
      ) : (
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Overall Status */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Overall KYC Status</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: STATUS_COLORS[kycData?.kycStatus || 'not_started'], background: 'rgba(255,255,255,0.05)', border: `1px solid ${STATUS_COLORS[kycData?.kycStatus || 'not_started']}30`, borderRadius: 20, padding: '4px 14px' }}>
                  {STATUS_LABELS[kycData?.kycStatus || 'not_started']}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#3DFF54' }}>{uploadedCount}/{KYC_STEPS.length}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>documents submitted</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #3DFF54, #00AFFF)', borderRadius: 8, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{progress}% complete</div>
          </div>

          {/* Steps Grid */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Required Documents</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {KYC_STEPS.map((step, idx) => {
                const status = getStepStatus(step.type);
                const doc = kycData?.kycDocuments?.find((d) => d.type === step.type);
                return (
                  <div key={step.type} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, backdropFilter: 'blur(8px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>{idx + 1}</div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{step.label}</span>
                      </div>
                      <StepBadge status={status} />
                    </div>
                    {doc && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={10} />
                        {doc.name} · {new Date(doc.uploadedAt).toLocaleDateString()}{doc.reviewNote ? ` · ${doc.reviewNote}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload Form */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Upload size={16} style={{ color: '#3DFF54' }} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>Submit a Document</span>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Document Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ type: e.target.value, fields: {} })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }}
                >
                  {KYC_STEPS.map((s) => (
                    <option key={s.type} value={s.type} style={{ background: '#111' }}>{s.label}</option>
                  ))}
                </select>
              </div>
              {(KYC_FIELDS[form.type] || []).map((field) => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  <input
                    type={field.type || 'text'}
                    placeholder={field.type === 'url' ? 'https://drive.google.com/...' : field.label}
                    value={form.fields[field.key] || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, fields: { ...prev.fields, [field.key]: e.target.value } }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={submitting}
                style={{ background: submitting ? 'rgba(61,255,84,0.3)' : 'rgba(61,255,84,0.15)', border: '1px solid rgba(61,255,84,0.4)', borderRadius: 10, padding: '11px 20px', color: '#3DFF54', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
              >
                <Upload size={14} />
                {submitting ? 'Submitting…' : 'Submit Document'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

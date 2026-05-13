import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuroraBackground from '../components/AuroraBackground';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconDownload, IconFileText, IconDollar } from '../components/Icons';
import { subscriptionsApi } from '../lib/api';

function formatCurrency(amount: number) {
  return `\u20B9${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

export default function InvoiceScreen() {
  const { subscriptionId } = useLocalSearchParams<{ subscriptionId?: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!subscriptionId) {
      setError('Missing subscription id.');
      setLoading(false);
      return;
    }
    subscriptionsApi.invoice(subscriptionId)
      .then((data: any) => setInvoice(data?.invoice || data || null))
      .catch((e: any) => {
        setInvoice(null);
        setError(e?.message || 'Could not load invoice.');
      })
      .finally(() => setLoading(false));
  }, [subscriptionId]);

  const handleShare = async () => {
    if (!invoice) return;
    try {
      await Share.share({
        message: `BookMyFit Invoice #${invoice.invoiceNumber}\nDate: ${formatDate(invoice.invoiceDate)}\nTotal: ${formatCurrency(invoice.total)}`,
        title: `Invoice ${invoice.invoiceNumber}`,
      });
    } catch (e: any) {
      Alert.alert('Share', e?.message || 'Unable to share invoice.');
    }
  };

  if (loading) {
    return (
      <AuroraBackground>
        <SafeAreaView style={s.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  if (!invoice) {
    return (
      <AuroraBackground>
        <SafeAreaView style={[s.centered, { padding: 24 }]}>
          <IconFileText size={44} color={colors.accent} />
          <Text style={s.pageTitle}>Invoice unavailable</Text>
          <Text style={s.emptyText}>{error || 'No invoice data was returned.'}</Text>
          <TouchableOpacity style={[s.backBtn, { marginTop: 18 }]} onPress={() => router.back()}>
            <IconArrowLeft size={18} color={colors.t} />
          </TouchableOpacity>
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  const items = invoice.items || [];
  const subtotal = invoice.subtotal ?? items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const cgst = invoice.cgst ?? Math.round(subtotal * 0.09);
  const sgst = invoice.sgst ?? Math.round(subtotal * 0.09);
  const total = invoice.total ?? subtotal + cgst + sgst;

  return (
    <AuroraBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <IconArrowLeft size={18} color={colors.t} />
            </TouchableOpacity>
            <Text style={s.pageTitle}>Invoice</Text>
            <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
              <IconDownload size={16} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={s.invoiceCard}>
            <View style={s.companyHeader}>
              <View style={s.logoBox}>
                <IconFileText size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.companyName}>BookMyFit Technologies Pvt Ltd</Text>
                <Text style={s.companyAddress}>support@bookmyfit.in</Text>
              </View>
              <View style={[s.statusBadge, invoice.status === 'paid' && s.statusPaid]}>
                <Text style={[s.statusText, invoice.status === 'paid' && s.statusTextPaid]}>
                  {(invoice.status || 'paid').toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.metaRow}>
              <View style={s.metaCol}>
                <Text style={s.metaLabel}>Invoice No.</Text>
                <Text style={s.metaValue}>{invoice.invoiceNumber || '-'}</Text>
              </View>
              <View style={s.metaCol}>
                <Text style={s.metaLabel}>Date</Text>
                <Text style={s.metaValue}>{formatDate(invoice.invoiceDate || '')}</Text>
              </View>
              <View style={s.metaCol}>
                <Text style={s.metaLabel}>Payment</Text>
                <Text style={s.metaValue}>{invoice.paymentMethod || 'Online'}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <Text style={s.sectionLabel}>Bill To</Text>
            <Text style={s.customerName}>{invoice.customer?.name || '-'}</Text>
            {!!invoice.customer?.phone && <Text style={s.customerDetail}>{invoice.customer.phone}</Text>}
            {!!invoice.customer?.email && <Text style={s.customerDetail}>{invoice.customer.email}</Text>}
            {!!invoice.gym?.name && (
              <Text style={s.customerDetail}>Gym: {invoice.gym.name}{invoice.gym?.city ? `, ${invoice.gym.city}` : ''}</Text>
            )}

            <View style={s.divider} />

            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 3 }]}>Description</Text>
              <Text style={[s.tableHeaderText, { width: 36, textAlign: 'center' }]}>Qty</Text>
              <Text style={[s.tableHeaderText, { width: 80, textAlign: 'right' }]}>Amount</Text>
            </View>
            {items.map((item: any, i: number) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.tableCell, { flex: 3 }]} numberOfLines={2}>{item.description || item.name || '-'}</Text>
                <Text style={[s.tableCell, { width: 36, textAlign: 'center' }]}>{item.quantity || 1}</Text>
                <Text style={[s.tableCell, { width: 80, textAlign: 'right' }]}>{formatCurrency(item.amount || 0)}</Text>
              </View>
            ))}

            <View style={s.divider} />

            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>CGST (9%)</Text>
              <Text style={s.totalValue}>{formatCurrency(cgst)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>SGST (9%)</Text>
              <Text style={s.totalValue}>{formatCurrency(sgst)}</Text>
            </View>

            <View style={s.divider} />

            <View style={s.totalRow}>
              <Text style={s.grandTotalLabel}>Total</Text>
              <View style={s.grandTotalValueWrap}>
                <IconDollar size={13} color={colors.accent} />
                <Text style={s.grandTotalValue}>{formatCurrency(total)}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={s.shareFullBtn} onPress={handleShare}>
            <IconDownload size={16} color="#000" />
            <Text style={s.shareFullBtnText}>Share Invoice</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.sans, color: colors.t2, textAlign: 'center', marginTop: 8 },
  container: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { flex: 1, fontFamily: fonts.serif, fontSize: 24, color: '#fff', letterSpacing: -0.5 },
  shareBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  invoiceCard: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    borderRadius: radius.xl, padding: 20, marginBottom: 16,
  },
  companyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  logoBox: {
    width: 44, height: 44, borderRadius: radius.lg,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  companyName: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff', marginBottom: 3 },
  companyAddress: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2, lineHeight: 15 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
  },
  statusPaid: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  statusText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.t2, letterSpacing: 0.5 },
  statusTextPaid: { color: colors.accent },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaCol: { flex: 1 },
  metaLabel: { fontFamily: fonts.sans, fontSize: 9, color: colors.t2, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  metaValue: { fontFamily: fonts.sansMedium, fontSize: 12, color: '#fff' },
  sectionLabel: { fontFamily: fonts.sans, fontSize: 9, color: colors.t2, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  customerName: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', marginBottom: 4 },
  customerDetail: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginBottom: 2 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8 },
  tableHeaderText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.t2, letterSpacing: 0.5, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 7 },
  tableCell: { fontFamily: fonts.sans, fontSize: 12, color: '#fff' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  totalLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  totalValue: { fontFamily: fonts.sansMedium, fontSize: 12, color: '#fff' },
  grandTotalLabel: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff' },
  grandTotalValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  grandTotalValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.accent },
  shareFullBtn: {
    height: 52, borderRadius: radius.lg,
    backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  shareFullBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#000' },
});

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconTrash, IconCart } from '../components/Icons';
import AuroraBackground from '../components/AuroraBackground';
import { storeApi, getUser } from '../lib/api';
import { DEFAULT_PRODUCT_IMAGE, firstImage } from '../lib/imageFallbacks';

type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
};

// In-memory cart store — shared across screens via module-level state
export let cartItems: CartItem[] = [];
export function addToCart(item: Omit<CartItem, 'quantity'> & { quantity?: number }) {
  const existing = cartItems.find((c) => c.productId === item.productId);
  if (existing) {
    existing.quantity += item.quantity ?? 1;
  } else {
    cartItems.push({ ...item, quantity: item.quantity ?? 1 });
  }
}
export function removeFromCart(productId: string) {
  cartItems = cartItems.filter((c) => c.productId !== productId);
}
export function clearCart() {
  cartItems = [];
}
export function cartCount() {
  return cartItems.reduce((acc, c) => acc + c.quantity, 0);
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 34);
  const [items, setItems] = useState<CartItem[]>([...cartItems]);
  const [placing, setPlacing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setItems([...cartItems]);
    }, []),
  );

  const total = items.reduce((acc, c) => acc + c.price * c.quantity, 0);

  const handleRemove = (productId: string) => {
    removeFromCart(productId);
    setItems([...cartItems]);
  };

  const handleChangeQty = (productId: string, delta: number) => {
    const item = cartItems.find((c) => c.productId === productId);
    if (!item) return;
    item.quantity = Math.max(1, item.quantity + delta);
    setItems([...cartItems]);
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setPlacing(true);
    try {
      const user = await getUser();
      const orderItems = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      const res: any = await storeApi.createOrder(
        orderItems,
        user?.address || user?.location || '',
        user?.phone || user?.phoneNumber || '',
      );
      const { order, payment } = res;
      clearCart();
      setItems([]);
      // Route through payment webview (Cashfree or mock)
      router.replace({
        pathname: '/payment-webview',
        params: {
          paymentSessionId: payment?.paymentSessionId || payment?.payment_session_id || '',
          orderId: payment?.orderId || payment?.order_id || order?.cashfreeOrderId || order?.id || '',
          returnRoute: 'store',
          serviceName: `Order #${String(order?.id || '').slice(0, 8).toUpperCase()}`,
          amount: String(order?.totalAmount || 0),
        },
      } as any);
    } catch (e: any) {
      Alert.alert('Order Failed', e?.message || 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <AuroraBackground variant="default">
      <SafeAreaView style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            Cart{items.length > 0 ? ` (${items.reduce((a, c) => a + c.quantity, 0)})` : ''}
          </Text>
          <View style={{ width: 38 }} />
        </View>

        {items.length === 0 ? (
          <View style={s.emptyState}>
            <IconCart size={48} color={colors.t3} />
            <Text style={s.emptyTitle}>Your cart is empty</Text>
            <Text style={s.emptySub}>Browse our store and add items to get started</Text>
            <TouchableOpacity style={s.browsBtn} onPress={() => router.push('/(tabs)/explore' as any)}>
              <Text style={s.browsBtnText}>Browse Store</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={[s.list, { paddingBottom: 16 }]} showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <View key={item.productId} style={s.card}>
                  <Image
                    source={{ uri: firstImage(item.image) || DEFAULT_PRODUCT_IMAGE }}
                    style={s.cardImage}
                  />
                  <View style={s.cardInfo}>
                    <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                    {item.category && <Text style={s.cardCat}>{item.category}</Text>}
                    <Text style={s.cardPrice}>₹{(item.price * item.quantity).toLocaleString()}</Text>
                    <View style={s.qtyRow}>
                      <TouchableOpacity style={s.qtyBtn} onPress={() => handleChangeQty(item.productId, -1)}>
                        <Text style={s.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.qtyNum}>{item.quantity}</Text>
                      <TouchableOpacity style={s.qtyBtn} onPress={() => handleChangeQty(item.productId, 1)}>
                        <Text style={s.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity style={s.removeBtn} onPress={() => handleRemove(item.productId)}>
                    <IconTrash size={16} color="rgba(255,80,80,0.8)" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Summary + CTA */}
            <View style={[s.summary, { paddingBottom: bottomInset + 14 }]}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</Text>
                <Text style={s.summaryValue}>₹{total.toLocaleString()}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Delivery</Text>
                <Text style={[s.summaryValue, { color: colors.accent }]}>FREE</Text>
              </View>
              <View style={[s.summaryRow, s.totalRow]}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalValue}>₹{total.toLocaleString()}</Text>
              </View>
              <TouchableOpacity
                style={[s.checkoutBtn, placing && { opacity: 0.6 }]}
                onPress={handleCheckout}
                disabled={placing}
                activeOpacity={0.88}
              >
                {placing ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={s.checkoutBtnText}>Place Order</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 18, color: '#fff', marginTop: 8 },
  emptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, textAlign: 'center' },
  browsBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: colors.accent, borderRadius: radius.xl,
  },
  browsBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: '#000' },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  cardImage: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.bg },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#fff' },
  cardCat: { fontFamily: fonts.sans, fontSize: 11, color: colors.t3 },
  cardPrice: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.accent },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff' },
  qtyNum: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', minWidth: 20, textAlign: 'center' },
  removeBtn: { padding: 6, marginTop: 2 },
  summary: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 20, paddingTop: 16, gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
  summaryValue: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#fff' },
  totalRow: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: '#fff' },
  totalValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.accent },
  checkoutBtn: {
    marginTop: 8, height: 52, borderRadius: radius.xl,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  checkoutBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#000' },
});

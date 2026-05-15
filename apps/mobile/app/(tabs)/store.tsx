import { useEffect, useState, useCallback } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ImageBackground, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { colors, fonts, radius } from '../../theme/brand';
import { IconCart, IconTag } from '../../components/Icons';
import { storeApi } from '../../lib/api';
import AuroraBackground from '../../components/AuroraBackground';
import { addToCart, cartCount as getCartCount } from '../cart';
import { productImage } from '../../lib/imageFallbacks';

const CATS = ['All', 'Supplements', 'Accessories', 'Apparel', 'Equipment'];

const AURORA_COLORS = ['rgba(0,212,106,0.55)', 'rgba(0,175,255,0.55)', 'rgba(155,0,255,0.55)', 'rgba(255,138,0,0.55)'];

export default function Store() {
  const [activeCat, setActiveCat] = useState('All');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(getCartCount());
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Refresh badge when returning from cart
  useFocusEffect(useCallback(() => { setCartCount(getCartCount()); }, []));

  useEffect(() => {
    setLoading(true);
    setError('');
    storeApi.products(activeCat !== 'All' ? activeCat.toLowerCase() : undefined)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.products || data?.data || [];
        setProducts(list);
      })
      .catch((e: any) => {
        setProducts([]);
        setError(e?.message || 'Could not load store products.');
      })
      .finally(() => setLoading(false));
  }, [activeCat]);

  const handleAddToCart = (product: any) => {
    const image = productImage(product);
    addToCart({
      productId: String(product.id || product._id),
      name: product.name || product.productName || 'Product',
      price: product.price ?? product.mrp ?? 0,
      image,
      category: product.category,
    });
    setCartCount(getCartCount());
  };

  const searchTerm = search.trim().toLowerCase();
  const visibleProducts = searchTerm
    ? products.filter((p: any) => {
      const text = [
        p.name,
        p.productName,
        p.brand,
        p.brandName,
        p.category,
        p.description,
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(searchTerm);
    })
    : products;

  return (
    <AuroraBackground>
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.titleRow}>
          <Text style={s.title}>Store</Text>
          <TouchableOpacity style={s.cartWrap} onPress={() => router.push('/cart' as any)}>
            <IconCart size={20} color={colors.t} />
            {cartCount > 0 && (
              <View style={s.cartBadge}>
                <Text style={s.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <IconTag size={15} color={colors.t2} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search protein, gloves, bands..."
            placeholderTextColor={colors.t3}
            style={s.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={s.clearSearchBtn}>
              <Text style={s.clearSearchText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {CATS.map((c) => (
            <TouchableOpacity key={c} style={[s.pill, activeCat === c && s.pillActive]} onPress={() => setActiveCat(c)}>
              <Text style={[s.pillText, activeCat === c && s.pillTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : visibleProducts.length === 0 ? (
          <View style={s.emptyState}>
            <IconTag size={40} color={colors.accent} />
            <Text style={s.emptyTitle}>No products found</Text>
            <Text style={s.emptyBody}>{error || (searchTerm ? 'Try another search term or category' : `Check back later for ${activeCat} products`)}</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {visibleProducts.map((p: any, idx: number) => {
              const name = p.name || p.productName || 'Product';
              const brand = p.brand || p.brandName || '';
              const price = p.price || p.mrp || 0;
              const img = productImage(p);
              const aurora = p.aurora || AURORA_COLORS[idx % AURORA_COLORS.length];
              return (
                <TouchableOpacity key={p.id || p._id || idx} style={s.card} activeOpacity={0.9} onPress={() => router.push(`/product/${p.id || p._id}`)}>
                  <ImageBackground source={{ uri: img }} style={s.cardImg} imageStyle={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
                    <View style={[s.cardAurora, { backgroundColor: aurora }]} />
                    <View style={s.cardDark} />
                  </ImageBackground>
                  <View style={s.cardBody}>
                    <Text style={s.prodName} numberOfLines={1}>{name}</Text>
                    {!!brand && <Text style={s.prodBrand} numberOfLines={1}>{brand}</Text>}
                    <View style={s.priceRow}>
                      <Text style={s.prodPrice} numberOfLines={1}>Rs {Number(price).toLocaleString('en-IN')}</Text>
                      <TouchableOpacity
                        style={s.cartBtn}
                        onPress={(event: any) => {
                          event?.stopPropagation?.();
                          handleAddToCart(p);
                        }}
                      >
                        <IconCart size={14} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  container: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: '#fff', letterSpacing: -0.5 },
  cartWrap: { position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cartBadge: {
    position: 'absolute', top: 0, right: 0, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: '#000' },
  searchBox: {
    minHeight: 48,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.055)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#fff',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
  clearSearchText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  pillText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.t2 },
  pillTextActive: { color: colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: {
    width: '48.3%', borderRadius: radius.xl, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  cardImg: { height: 120, position: 'relative' },
  cardAurora: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  cardDark: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  cardBody: { padding: 10 },
  prodName: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff' },
  prodBrand: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  prodPrice: { flex: 1, minWidth: 0, fontFamily: fonts.sansBold, fontSize: 14, color: colors.accent },
  cartBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff' },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
});

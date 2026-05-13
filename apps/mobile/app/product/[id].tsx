import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, Animated, Dimensions, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '../../theme/brand';
import { IconArrowLeft, IconStar, IconShare, IconCart, IconCheck } from '../../components/Icons';
import AuroraBackground from '../../components/AuroraBackground';
import { api } from '../../lib/api';
import { addToCart } from '../cart';
import { productImage } from '../../lib/imageFallbacks';

const { width } = Dimensions.get('window');
const HERO_HEIGHT = 300;

function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <View style={s.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar
          key={i}
          size={14}
          color={i <= Math.round(rating) ? colors.star : 'rgba(255,255,255,0.2)'}
        />
      ))}
      <Text style={s.ratingCount}>
        {rating > 0 ? rating.toFixed(1) : '—'}
      </Text>
      {count > 0 && (
        <Text style={s.reviewLink}>({count} reviews)</Text>
      )}
    </View>
  );
}

function ReviewCard({ review }: { review: any }) {
  const name = review.userName || review.user?.name || 'Anonymous';
  const rating = review.rating || review.stars || 5;
  const text = review.text || review.comment || review.review || '';
  const date = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <View style={s.reviewCard}>
      <View style={s.reviewHeader}>
        <View style={s.reviewAvatar}>
          <Text style={s.reviewAvatarText}>{name[0]?.toUpperCase() || 'A'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.reviewName}>{name}</Text>
          <View style={s.starRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <IconStar key={i} size={11} color={i <= rating ? colors.star : 'rgba(255,255,255,0.2)'} />
            ))}
          </View>
        </View>
        {!!date && <Text style={s.reviewDate}>{date}</Text>}
      </View>
      {!!text && <Text style={s.reviewText}>{text}</Text>}
    </View>
  );
}

function extractBullets(product: any): string[] {
  if (product?.features && Array.isArray(product.features) && product.features.length > 0) {
    return product.features.slice(0, 3);
  }
  if (product?.highlights && Array.isArray(product.highlights) && product.highlights.length > 0) {
    return product.highlights.slice(0, 3);
  }
  const desc: string = product?.description || '';
  if (desc.length > 60) {
    const sentences = desc.split(/[.!]/g).map((s: string) => s.trim()).filter((s: string) => s.length > 10);
    if (sentences.length >= 2) return sentences.slice(0, 3);
  }
  return [];
}

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 34);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addedState, setAddedState] = useState<'idle' | 'adding' | 'added'>('idle');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;

    const loadProduct = api.get(`/store/products/${id}`)
      .then((data: any) => data?.product || data)
      .catch(() =>
        api.get(`/store/products?id=${id}`)
          .then((data: any) => {
            const list = Array.isArray(data) ? data : data?.products || data?.data || [];
            return list.find((p: any) => (p.id || p._id) === id) || null;
          })
          .catch(() => null)
      );

    const loadReviews = api.get(`/ratings?productId=${id}`)
      .then((data: any) => Array.isArray(data) ? data : data?.ratings || data?.data || [])
      .catch(() => []);

    Promise.all([loadProduct, loadReviews])
      .then(([prod, revs]) => {
        setProduct(prod);
        setReviews(revs);
      })
      .finally(() => {
        setLoading(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
  }, [id]);

  const handleAddToCart = async (navigateAfter = false) => {
    if (addedState === 'adding') return;
    setAddedState('adding');
    try {
      addToCart({
        productId: String(id),
        name: product?.name || product?.productName || 'Product',
        price: product?.price ?? product?.mrp ?? 0,
        quantity,
        image: productImage(product),
        category: product?.category,
      });
      setAddedState('added');
      setTimeout(() => {
        setAddedState('idle');
        if (navigateAfter) router.push('/cart');
      }, 1500);
    } catch {
      setAddedState('idle');
    }
  };

  const handleShare = () => {
    const name = product?.name || product?.productName || 'Product';
    Share.share({ message: `Check out ${name} on BookMyFit!` }).catch(() => {});
  };

  if (loading) {
    return (
      <AuroraBackground variant="store">
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  if (!product) {
    return (
      <AuroraBackground variant="store">
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: '#fff', textAlign: 'center' }}>Product not found</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.t2, textAlign: 'center', marginTop: 8 }}>
            This product is not available from the server right now.
          </Text>
          <TouchableOpacity style={[s.buyNowBtn, { marginTop: 18, paddingHorizontal: 24, flex: 0 }]} onPress={() => router.back()}>
            <Text style={s.buyNowText}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  const name = product?.name || product?.productName || 'Product';
  const brand = product?.brand || product?.brandName || '';
  const category = product?.category || product?.categoryName || '';
  const description = product?.description || '';
  const imgUri = productImage(product);

  const price = product?.price || product?.salePrice || 0;
  const originalPrice = product?.mrp || product?.originalPrice || null;
  const discount = originalPrice && originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;

  const avgRating = product?.rating || product?.avgRating || 0;
  const reviewCount = product?.reviewCount || reviews.length || 0;
  const bullets = extractBullets(product);
  const topReviews = reviews.slice(0, 3);

  return (
    <AuroraBackground variant="store">
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} bounces>
          {/* Hero Image */}
          <View style={s.hero}>
            <Image source={{ uri: imgUri }} style={s.heroImg} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(6,6,6,0.82)', colors.bg]}
              style={s.heroGradient}
            />
            <SafeAreaView style={s.heroButtons}>
              <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
                <IconArrowLeft size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={handleShare}>
                <IconShare size={18} color="#fff" />
              </TouchableOpacity>
            </SafeAreaView>
          </View>

          <Animated.View style={[s.content, { opacity: fadeAnim }]}>
            {/* Category chip */}
            {!!category && (
              <View style={s.chip}>
                <Text style={s.chipText}>{category}</Text>
              </View>
            )}

            {/* Product name + brand */}
            <Text style={s.productName}>{name}</Text>
            {!!brand && <Text style={s.brandName}>{brand}</Text>}

            {/* Rating row */}
            <StarRow rating={avgRating} count={reviewCount} />

            {/* Price row */}
            <View style={s.priceRow}>
              <Text style={s.price}>₹{Number(price).toLocaleString('en-IN')}</Text>
              {!!originalPrice && originalPrice > price && (
                <Text style={s.originalPrice}>₹{Number(originalPrice).toLocaleString('en-IN')}</Text>
              )}
              {discount > 0 && (
                <View style={s.saveBadge}>
                  <Text style={s.saveBadgeText}>Save {discount}%</Text>
                </View>
              )}
            </View>

            {/* Quantity selector */}
            <View style={s.qtyRow}>
              <Text style={s.qtyLabel}>Quantity</Text>
              <View style={s.qtyCtrls}>
                <TouchableOpacity
                  style={s.qtyBtn}
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Text style={s.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.qtyCount}>{quantity}</Text>
                <TouchableOpacity
                  style={s.qtyBtn}
                  onPress={() => setQuantity((q) => q + 1)}
                >
                  <Text style={s.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Description card */}
            {!!description && (
              <View style={s.glassCard}>
                <Text style={s.cardHeading}>About this product</Text>
                <Text style={s.descText}>{description}</Text>
              </View>
            )}

            {/* Benefits/Highlights */}
            {bullets.length > 0 && (
              <View style={s.glassCard}>
                <Text style={s.cardHeading}>Why you'll love it</Text>
                {bullets.map((b, i) => (
                  <View key={i} style={s.bulletRow}>
                    <View style={s.bulletDot}>
                      <IconCheck size={11} color={colors.accent} />
                    </View>
                    <Text style={s.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Reviews section */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Reviews</Text>
              {topReviews.length > 0 ? (
                topReviews.map((r, i) => <ReviewCard key={i} review={r} />)
              ) : (
                <View style={s.glassCard}>
                  <Text style={s.noReviews}>No reviews yet. Be the first!</Text>
                </View>
              )}
            </View>

            {/* Spacer for buttons */}
            <View style={{ height: 92 + bottomInset }} />
          </Animated.View>
        </ScrollView>

        {/* Sticky bottom actions */}
        <View style={[s.stickyBar, { paddingBottom: bottomInset + 14 }]}>
          <TouchableOpacity
            style={[s.addCartBtn, addedState === 'added' && s.addCartBtnAdded]}
            onPress={() => handleAddToCart(false)}
            disabled={addedState === 'adding'}
            activeOpacity={0.85}
          >
            {addedState === 'adding' ? (
              <ActivityIndicator color="#000" size="small" />
            ) : addedState === 'added' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconCheck size={16} color="#000" />
                <Text style={s.addCartBtnText}>Added to Cart!</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconCart size={16} color="#000" />
                <Text style={s.addCartBtnText}>Add to Cart</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.buyNowBtn}
            onPress={() => handleAddToCart(true)}
            disabled={addedState === 'adding'}
            activeOpacity={0.85}
          >
            <Text style={s.buyNowText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  hero: { width, height: HERO_HEIGHT, position: 'relative' },
  heroImg: { width, height: HERO_HEIGHT },
  heroGradient: { ...StyleSheet.absoluteFillObject, top: HERO_HEIGHT * 0.4 },
  heroButtons: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: 20, paddingTop: 4 },

  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,212,106,0.13)',
    borderWidth: 1, borderColor: 'rgba(0,212,106,0.28)',
    marginBottom: 10,
  },
  chipText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent, letterSpacing: 0.5 },

  productName: {
    fontFamily: fonts.serifBlack,
    fontSize: 26, color: '#fff', lineHeight: 32,
    marginBottom: 4,
  },
  brandName: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, marginBottom: 10 },

  starRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 14 },
  ratingCount: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.star, marginLeft: 4 },
  reviewLink: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, marginLeft: 2 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  price: { fontFamily: fonts.sansBold, fontSize: 28, color: colors.accent },
  originalPrice: {
    fontFamily: fonts.sans, fontSize: 16, color: colors.t2,
    textDecorationLine: 'line-through',
  },
  saveBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(0,212,106,0.13)',
    borderWidth: 1, borderColor: 'rgba(0,212,106,0.28)',
  },
  saveBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  qtyLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.t },
  qtyCtrls: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontFamily: fonts.sansBold, fontSize: 18, color: '#fff', lineHeight: 22 },
  qtyCount: {
    fontFamily: fonts.sansBold, fontSize: 16, color: '#fff',
    minWidth: 40, textAlign: 'center',
  },

  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 20, padding: 16, marginBottom: 14,
  },
  cardHeading: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', marginBottom: 8 },
  descText: { fontFamily: fonts.sans, fontSize: 13, color: colors.t, lineHeight: 20 },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bulletDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,212,106,0.13)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  bulletText: { fontFamily: fonts.sans, fontSize: 13, color: colors.t, flex: 1, lineHeight: 20 },

  section: { marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff', marginBottom: 12 },
  noReviews: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, textAlign: 'center', paddingVertical: 8 },

  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 20, padding: 14, marginBottom: 10,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,212,106,0.13)',
    borderWidth: 1, borderColor: 'rgba(0,212,106,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.accent },
  reviewName: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff', marginBottom: 2 },
  reviewDate: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2 },
  reviewText: { fontFamily: fonts.sans, fontSize: 12, color: colors.t, lineHeight: 18 },

  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(6,6,6,0.92)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 20, paddingTop: 12,
    flexDirection: 'row', gap: 10,
  },
  addCartBtn: {
    flex: 1, height: 50, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  addCartBtnAdded: { backgroundColor: 'rgba(0,212,106,0.75)' },
  addCartBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#000' },
  buyNowBtn: {
    flex: 1, height: 50, borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  buyNowText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.accent },
});

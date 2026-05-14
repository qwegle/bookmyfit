import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme/brand';

export default function AppLoadingScreen() {
  return (
    <View style={s.root}>
      <LinearGradient
        colors={['rgba(0,212,106,0.18)', 'rgba(255,30,90,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.glow}
      />
      <View style={s.logoBox}>
        <Text style={s.logoText}>BMF</Text>
      </View>
      <Text style={s.title}>BookMyFit</Text>
      <Text style={s.subtitle}>Getting your fitness pass ready</Text>
      <ActivityIndicator color={colors.accent} style={s.loader} />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  logoBox: {
    width: 74,
    height: 74,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    marginBottom: 18,
  },
  logoText: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.t2,
    fontSize: 13,
    marginTop: 6,
  },
  loader: {
    marginTop: 22,
  },
});

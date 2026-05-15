import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme/brand';
import { IconQR, IconUser, IconDumbbell, IconDollar, IconCheck } from '../../components/Icons';

export default function GymPortalLayout() {
  const insets = useSafeAreaInsets();
  const minBottomPad = Platform.OS === 'android' ? 8 : 10;
  const tabBarBottomPad = Math.max(insets.bottom, minBottomPad);
  const tabBarHeight = 58 + tabBarBottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: tabBarBottomPad,
          elevation: 18,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.t2,
        tabBarLabelStyle: { fontFamily: fonts.sansBold, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconDumbbell size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan QR',
          tabBarIcon: ({ color }) => <IconQR size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          tabBarIcon: ({ color }) => <IconUser size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => <IconDollar size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kyc"
        options={{
          title: 'KYC',
          tabBarIcon: ({ color }) => <IconCheck size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

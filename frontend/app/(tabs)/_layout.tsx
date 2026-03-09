import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, borderRadius, spacing } from '../../src/components/theme';
import { useAppStore } from '../../src/store/appStore';

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shoppingList } = useAppStore();
  
  const uncheckedCount = shoppingList.filter(item => !item.checked).length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: colors.cardBackground,
        },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontWeight: '600',
          fontSize: 18,
        },
        headerShadowVisible: false,
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            {/* Household/Invite Button */}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/household')}
            >
              <Ionicons 
                name="people-outline"
                size={24} 
                color={colors.textMuted} 
              />
            </TouchableOpacity>
            
            {/* Shopping List Button */}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/shopping-list')}
            >
              <View>
                <Ionicons name="cart-outline" size={24} color={colors.textPrimary} />
                {uncheckedCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {uncheckedCount > 9 ? '9+' : uncheckedCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Settings Button */}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="home-stock"
        options={{
          title: 'Home Stock',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="emergency-stock"
        options={{
          title: 'Emergency',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="medkit-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginRight: spacing.md,
    padding: spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.danger,
    borderRadius: borderRadius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});

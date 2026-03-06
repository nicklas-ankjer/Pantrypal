import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/components/theme';
import { useAppStore } from '../../src/store/appStore';
import { format, differenceInDays } from 'date-fns';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    dashboard,
    homeStock,
    shoppingList,
    fetchDashboard,
    fetchHomeStock,
    fetchShoppingList,
    fetchRecipes,
    fetchEmergencyStock,
    quickAddHomeStock,
    loading,
  } = useAppStore();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      fetchDashboard(),
      fetchHomeStock(),
      fetchShoppingList(),
      fetchRecipes(),
      fetchEmergencyStock(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading && !dashboard) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your kitchen...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
        </View>

        {/* Low Stock Alerts */}
        {dashboard?.low_stock_alerts && dashboard.low_stock_alerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning-outline" size={20} color={colors.warning} />
              <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
            </View>
            {dashboard.low_stock_alerts.map((item) => (
              <View key={item.id} style={[styles.alertCard, styles.warningCard]}>
                <View style={styles.alertContent}>
                  <Text style={styles.alertText}>{item.name}</Text>
                  <Text style={styles.alertSubtext}>
                    {item.quantity} {item.unit} remaining (Safety: {item.safety_stock})
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.alertAction}
                  onPress={() => router.push('/shopping-list')}
                >
                  <Ionicons name="add-circle" size={24} color={colors.warning} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Expiring Items */}
        {dashboard?.expiring_items && dashboard.expiring_items.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={20} color={colors.danger} />
              <Text style={styles.sectionTitle}>Expiring Soon</Text>
            </View>
            {dashboard.expiring_items.map((item) => (
              <View key={item.id} style={[styles.alertCard, styles.dangerCard]}>
                <View style={styles.alertContent}>
                  <Text style={styles.alertText}>{item.name}</Text>
                  <Text style={styles.alertSubtext}>
                    {item.days_until_expiry <= 0
                      ? 'Expired!'
                      : item.days_until_expiry === 1
                      ? 'Expires tomorrow'
                      : `Expires in ${item.days_until_expiry} days`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* What You Can Cook */}
        {dashboard?.recipes_you_can_cook && dashboard.recipes_you_can_cook.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>You Can Cook</Text>
            </View>
            {dashboard.recipes_you_can_cook.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              >
                <Text style={styles.recipeText}>{recipe.name}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/what-can-i-cook')}
            >
              <Text style={styles.viewAllText}>View all suggestions</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Shopping List Reminder */}
        <TouchableOpacity
          style={styles.shoppingCard}
          onPress={() => router.push('/shopping-list')}
        >
          <View style={styles.shoppingLeft}>
            <Ionicons name="cart" size={24} color={colors.primary} />
            <Text style={styles.shoppingText}>Shopping List</Text>
          </View>
          <View style={styles.shoppingRight}>
            <Text style={styles.shoppingCount}>
              {shoppingList.filter(i => !i.checked).length} items
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Quick Add Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Quick Adjust</Text>
          </View>
          <View style={styles.quickAddGrid}>
            {homeStock.slice(0, 6).map((item) => (
              <View key={item.id} style={styles.quickAddItem}>
                <Text style={styles.quickAddName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.quickAddQty}>
                  {item.quantity} {item.unit}
                </Text>
                <View style={styles.quickAddButtons}>
                  <TouchableOpacity
                    style={styles.quickAddBtn}
                    onPress={() => quickAddHomeStock(item.id, -1)}
                  >
                    <Ionicons name="remove" size={18} color={colors.danger} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickAddBtn}
                    onPress={() => quickAddHomeStock(item.id, 1)}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          {homeStock.length === 0 && (
            <TouchableOpacity
              style={styles.emptyQuickAdd}
              onPress={() => router.push('/add-home-stock')}
            >
              <Ionicons name="add-circle-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>Add items to your stock</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  date: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    marginLeft: spacing.sm,
  },
  alertCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  warningCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  dangerCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    ...typography.body,
    fontWeight: '500',
  },
  alertSubtext: {
    ...typography.caption,
    marginTop: 2,
  },
  alertAction: {
    padding: spacing.xs,
  },
  recipeCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.sm,
  },
  recipeText: {
    ...typography.body,
    fontWeight: '500',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  viewAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  shoppingCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.md,
  },
  shoppingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shoppingText: {
    ...typography.h3,
    marginLeft: spacing.sm,
  },
  shoppingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shoppingCount: {
    ...typography.body,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  quickAddItem: {
    width: '50%',
    padding: spacing.xs,
  },
  quickAddName: {
    ...typography.bodySmall,
    fontWeight: '500',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.sm,
    paddingBottom: spacing.xs,
  },
  quickAddQty: {
    ...typography.caption,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  quickAddButtons: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: spacing.xs,
    paddingTop: 0,
  },
  quickAddBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    marginHorizontal: 2,
  },
  emptyQuickAdd: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});

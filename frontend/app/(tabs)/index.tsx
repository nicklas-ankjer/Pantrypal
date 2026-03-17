import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/components/theme';
import { useAppStore } from '../../src/store/appStore';
import { useAuthStore } from '../../src/store/authStore';
import { shoppingListApi } from '../../src/api/client';
import { format, differenceInDays } from 'date-fns';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface DinnerWish {
  id: string;
  username: string;
  recipe_id: string;
  recipe_name: string;
  created_at: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [dinnerWishes, setDinnerWishes] = useState<DinnerWish[]>([]);
  const { user, isAuthenticated, isChild } = useAuthStore();
  
  const {
    dashboard,
    homeStock,
    shoppingList,
    fetchDashboard,
    fetchHomeStock,
    fetchShoppingList,
    fetchRecipes,
    fetchEmergencyStock,
    loading,
  } = useAppStore();

  useEffect(() => {
    // If child user, redirect to child home
    if (isAuthenticated && user?.role === 'child') {
      router.replace('/child-home');
      return;
    }
    loadAllData();
  }, [isAuthenticated, user]);

  const loadAllData = async () => {
    await Promise.all([
      fetchDashboard(),
      fetchHomeStock(),
      fetchShoppingList(),
      fetchRecipes(),
      fetchEmergencyStock(),
      fetchDinnerWishes(),
    ]);
  };

  const fetchDinnerWishes = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE}/api/wishes?user_id=${user.id}&status=pending`);
      setDinnerWishes(response.data.wishes || []);
    } catch (error) {
      console.error('Failed to fetch dinner wishes:', error);
    }
  };

  const handleApproveWish = async (wishId: string, recipeName: string) => {
    try {
      const response = await axios.put(`${API_BASE}/api/wishes/${wishId}/approve?user_id=${user?.id}`);
      const data = response.data;
      
      // Show feedback based on what was added
      if (data.missing_added > 0) {
        Alert.alert(
          '✓ Wish Approved!', 
          `${recipeName} approved!\n\n${data.missing_added} missing ingredient${data.missing_added !== 1 ? 's' : ''} added to shopping list:\n• ${data.added_items.join('\n• ')}`
        );
        // Refresh shopping list
        await fetchShoppingList();
      } else {
        Alert.alert('✓ Wish Approved!', `${recipeName} approved!\n\nAll ingredients are in stock.`);
      }
      
      await fetchDinnerWishes();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve wish');
    }
  };

  const handleDismissWish = async (wishId: string) => {
    try {
      await axios.delete(`${API_BASE}/api/wishes/${wishId}?user_id=${user?.id}`);
      await fetchDinnerWishes();
    } catch (error) {
      Alert.alert('Error', 'Failed to dismiss wish');
    }
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

  // Add low stock item to shopping list and navigate there
  const handleAddToShoppingList = async (item: any) => {
    try {
      // Find the home stock item to get the unit
      const stockItem = homeStock.find(s => s.id === item.id);
      const unit = stockItem?.unit || 'pieces';
      
      // Add to shopping list with quantity 0 (user will enter)
      const response = await shoppingListApi.create({
        name: item.name,
        quantity: 1, // Default to 1, user can edit
        unit: unit,
      });
      
      await fetchShoppingList();
      
      // Navigate to shopping list with the new item ID to edit
      router.push({
        pathname: '/shopping-list',
        params: { editItemId: response.data.id }
      });
    } catch (error) {
      console.error('Failed to add to shopping list:', error);
      Alert.alert('Error', 'Failed to add item to shopping list');
    }
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
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          </View>
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
                  onPress={() => handleAddToShoppingList(item)}
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

        {/* Dinner Wishes from Family */}
        {dinnerWishes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={20} color={colors.danger} />
              <Text style={styles.sectionTitle}>Dinner Wishes</Text>
            </View>
            {dinnerWishes.map((wish) => (
              <View key={wish.id} style={styles.wishCard}>
                <View style={styles.wishContent}>
                  <Text style={styles.wishRecipeName}>{wish.recipe_name}</Text>
                  <Text style={styles.wishFrom}>from {wish.username}</Text>
                </View>
                <View style={styles.wishActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApproveWish(wish.id, wish.recipe_name)}
                  >
                    <Ionicons name="checkmark" size={20} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => handleDismissWish(wish.id)}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
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
  headerLeft: {
    flex: 1,
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
  // Dinner Wishes styles
  wishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  wishContent: {
    flex: 1,
  },
  wishRecipeName: {
    ...typography.body,
    fontWeight: '600',
  },
  wishFrom: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  wishActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  approveBtn: {
    backgroundColor: colors.success,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtn: {
    backgroundColor: colors.background,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
});

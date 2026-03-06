import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/components/theme';
import { recipesApi, shoppingListApi } from '../../src/api/client';
import { useAppStore } from '../../src/store/appStore';
import { IngredientAvailability } from '../../src/types';

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const { fetchHomeStock, fetchShoppingList } = useAppStore();
  
  const [recipe, setRecipe] = useState<any>(null);
  const [availability, setAvailability] = useState<IngredientAvailability[]>([]);
  const [canCook, setCanCook] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cooking, setCooking] = useState(false);

  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [recipeRes, availRes] = await Promise.all([
        recipesApi.get(id),
        recipesApi.checkAvailability(id),
      ]);
      setRecipe(recipeRes.data);
      setAvailability(availRes.data.ingredients);
      setCanCook(availRes.data.can_cook);
    } catch (error) {
      console.error('Failed to load recipe:', error);
      Alert.alert('Error', 'Failed to load recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMissingToList = async () => {
    const missing = availability.filter(i => i.status === 'missing' || i.status === 'insufficient');
    if (missing.length === 0) {
      Alert.alert('No Missing Items', 'All ingredients are available!');
      return;
    }

    setCooking(true);
    try {
      const missingIngredients = missing.map(m => ({
        name: m.ingredient,
        quantity: Math.max(0.1, m.required - m.available),
        unit: m.unit,
      }));
      console.log('Adding missing ingredients:', missingIngredients);
      await shoppingListApi.addMissing(missingIngredients);
      await fetchShoppingList();
      Alert.alert('Added!', `${missing.length} missing ingredient${missing.length !== 1 ? 's' : ''} added to shopping list`);
    } catch (error) {
      console.error('Failed to add missing:', error);
      Alert.alert('Error', 'Failed to add ingredients to shopping list');
    } finally {
      setCooking(false);
    }
  };

  const handleCook = async () => {
    if (!canCook) {
      // Directly add missing items to shopping list
      await handleAddMissingToList();
      return;
    }

    const belowSafety = availability.filter(i => i.status === 'below_safety');
    if (belowSafety.length > 0) {
      Alert.alert(
        'Low Stock Warning',
        `Cooking this will put ${belowSafety.length} item${belowSafety.length !== 1 ? 's' : ''} below safety stock. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cook Anyway', onPress: performCook },
        ]
      );
    } else {
      performCook();
    }
  };

  const performCook = async () => {
    setCooking(true);
    try {
      const result = await recipesApi.cook(id!, false);
      if (result.data.success) {
        Alert.alert('Success', `Enjoy your ${recipe?.name}!`);
        await fetchHomeStock();
        await loadRecipe(); // Refresh availability
      } else {
        Alert.alert('Error', result.data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to cook recipe');
    } finally {
      setCooking(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return colors.success;
      case 'below_safety': return colors.warning;
      case 'missing': return colors.danger;
      case 'insufficient': return colors.danger;
      default: return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return 'checkmark-circle';
      case 'below_safety': return 'warning';
      case 'missing': return 'close-circle';
      case 'insufficient': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Available';
      case 'below_safety': return 'Below Safety';
      case 'missing': return 'Missing';
      case 'insufficient': return 'Insufficient';
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Recipe not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{recipe.name}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <View style={[
          styles.statusCard,
          canCook ? styles.statusCardReady : styles.statusCardNotReady
        ]}>
          <Ionicons
            name={canCook ? 'checkmark-circle' : 'alert-circle'}
            size={24}
            color={canCook ? colors.success : colors.warning}
          />
          <Text style={styles.statusText}>
            {canCook ? 'Ready to cook!' : 'Missing some ingredients'}
          </Text>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {availability.map((ing, index) => (
            <View key={index} style={styles.ingredientCard}>
              <View style={styles.ingredientLeft}>
                <Ionicons
                  name={getStatusIcon(ing.status) as any}
                  size={20}
                  color={getStatusColor(ing.status)}
                />
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>{ing.ingredient}</Text>
                  <Text style={styles.ingredientQty}>
                    Need: {ing.required} {ing.unit}
                    {ing.available > 0 && ` • Have: ${ing.available}`}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(ing.status) + '20' }
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  { color: getStatusColor(ing.status) }
                ]}>
                  {getStatusLabel(ing.status)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Emergency Stock Notice */}
        {availability.some(i => i.in_emergency_stock && (i.status === 'missing' || i.status === 'insufficient')) && (
          <View style={styles.emergencyNotice}>
            <Ionicons name="medkit" size={20} color={colors.info} />
            <Text style={styles.emergencyText}>
              Some missing ingredients are available in Emergency Stock
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[
            styles.cookBtn,
            !canCook && styles.cookBtnDisabled,
            cooking && styles.cookBtnLoading
          ]}
          onPress={handleCook}
          disabled={cooking}
        >
          <Ionicons
            name={canCook ? 'flame' : 'cart'}
            size={22}
            color={colors.white}
          />
          <Text style={styles.cookBtnText}>
            {cooking ? 'Cooking...' : canCook ? 'Cook This Recipe' : 'Add Missing to List'}
          </Text>
        </TouchableOpacity>
      </View>
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
  errorText: {
    ...typography.body,
    color: colors.textMuted,
  },
  backLink: {
    marginTop: spacing.md,
  },
  backLinkText: {
    ...typography.body,
    color: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 4,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  statusCardReady: {
    backgroundColor: colors.success + '15',
  },
  statusCardNotReady: {
    backgroundColor: colors.warning + '15',
  },
  statusText: {
    ...typography.body,
    fontWeight: '500',
    marginLeft: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  ingredientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  ingredientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ingredientInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  ingredientName: {
    ...typography.body,
    fontWeight: '500',
  },
  ingredientQty: {
    ...typography.caption,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emergencyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '15',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  emergencyText: {
    ...typography.bodySmall,
    color: colors.info,
    marginLeft: spacing.sm,
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },
  cookBtnDisabled: {
    backgroundColor: colors.warning,
  },
  cookBtnLoading: {
    opacity: 0.7,
  },
  cookBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});

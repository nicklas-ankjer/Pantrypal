import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  FlatList,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../src/components/theme';
import { useAuthStore } from '../src/store/authStore';
import { recipesApi } from '../src/api/client';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Recipe {
  id: string;
  name: string;
  ingredients: { name: string; quantity: number; unit: string }[];
  image?: string;
}

interface CookableRecipe {
  id: string;
  name: string;
  available_ingredients: number;
  total_ingredients: number;
  percentage: number;
}

interface DinnerWish {
  id: string;
  recipe_id: string;
  recipe_name: string;
  status: string;
  created_at: string;
}

export default function ChildHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, household, isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [cookableRecipes, setCookableRecipes] = useState<CookableRecipe[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [myWishes, setMyWishes] = useState<DinnerWish[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [maxWishes, setMaxWishes] = useState(7);
  
  // Modal states
  const [showCookModal, setShowCookModal] = useState(false);
  const [showWishModal, setShowWishModal] = useState(false);
  const [addingWish, setAddingWish] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Wait for hydration to complete
    const timer = setTimeout(() => {
      setInitializing(false);
      if (!isAuthenticated) {
        router.replace('/auth');
        return;
      }
      loadData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch what can I cook
      const cookRes = await recipesApi.whatCanICook();
      setCookableRecipes(cookRes.data.can_cook || []);
      
      // Fetch all recipes
      const recipesRes = await recipesApi.getAll();
      setAllRecipes(recipesRes.data);
      
      // Fetch my wishes
      if (user) {
        const wishRes = await axios.get(`${API_BASE}/api/wishes?user_id=${user.id}`);
        setMyWishes(wishRes.data.wishes.filter((w: DinnerWish) => w.status === 'pending'));
        setPendingCount(wishRes.data.pending_count);
        setMaxWishes(wishRes.data.max_wishes);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWish = async (recipe: Recipe) => {
    if (pendingCount >= maxWishes) {
      Alert.alert(
        'Maximum Wishes Reached',
        `You can only have ${maxWishes} pending wishes. Wait for an adult to approve some.`
      );
      return;
    }

    // Check if already wished
    if (myWishes.find(w => w.recipe_id === recipe.id)) {
      Alert.alert('Already Wished', 'You already wished for this recipe!');
      return;
    }

    setAddingWish(true);
    try {
      await axios.post(`${API_BASE}/api/wishes?user_id=${user?.id}`, {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
      });
      
      Alert.alert('Wish Sent!', `Your wish for ${recipe.name} has been sent to the adults!`);
      await loadData();
      setShowWishModal(false);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to add wish';
      Alert.alert('Error', message);
    } finally {
      setAddingWish(false);
    }
  };

  const handleRemoveWish = async (wishId: string) => {
    try {
      await axios.delete(`${API_BASE}/api/wishes/${wishId}?user_id=${user?.id}`);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to remove wish');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth');
  };

  if (initializing || (loading && !cookableRecipes.length)) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.username}!</Text>
          {household && (
            <Text style={styles.householdName}>{household.name}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* My Current Wishes */}
        {myWishes.length > 0 && (
          <View style={styles.wishesSection}>
            <Text style={styles.sectionTitle}>My Dinner Wishes ({myWishes.length}/{maxWishes})</Text>
            {myWishes.map((wish) => (
              <View key={wish.id} style={styles.wishCard}>
                <Ionicons name="heart" size={20} color={colors.danger} />
                <Text style={styles.wishName}>{wish.recipe_name}</Text>
                <TouchableOpacity onPress={() => handleRemoveWish(wish.id)}>
                  <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Two Big Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.bigButton, styles.cookButton]}
            onPress={() => setShowCookModal(true)}
          >
            <View style={styles.buttonIconContainer}>
              <Ionicons name="flame" size={48} color={colors.white} />
            </View>
            <Text style={styles.bigButtonTitle}>What Can I Cook?</Text>
            <Text style={styles.bigButtonSubtitle}>
              {cookableRecipes.length} recipes ready
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bigButton, styles.wishButton]}
            onPress={() => setShowWishModal(true)}
          >
            <View style={styles.buttonIconContainer}>
              <Ionicons name="heart" size={48} color={colors.white} />
            </View>
            <Text style={styles.bigButtonTitle}>Dinner Wishes</Text>
            <Text style={styles.bigButtonSubtitle}>
              {allRecipes.length} recipes to choose from
            </Text>
          </TouchableOpacity>
        </View>

        {!household && (
          <View style={styles.noHouseholdCard}>
            <Ionicons name="home-outline" size={32} color={colors.warning} />
            <Text style={styles.noHouseholdText}>
              You need to join a household to see recipes
            </Text>
            <TouchableOpacity 
              style={styles.joinBtn}
              onPress={() => router.push('/household')}
            >
              <Text style={styles.joinBtnText}>Join Household</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* What Can I Cook Modal */}
      <Modal
        visible={showCookModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCookModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCookModal(false)}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>What Can I Cook?</Text>
            <View style={{ width: 28 }} />
          </View>

          {cookableRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Recipes Available</Text>
              <Text style={styles.emptySubtitle}>
                Ask an adult to add some ingredients to the stock
              </Text>
            </View>
          ) : (
            <FlatList
              data={cookableRecipes}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.recipeList}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.recipeCard}
                  onPress={() => {
                    setShowCookModal(false);
                    router.push(`/recipe/${item.id}`);
                  }}
                >
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeName}>{item.name}</Text>
                    <Text style={styles.recipeIngredients}>
                      {item.available_ingredients}/{item.total_ingredients} ingredients ready
                    </Text>
                  </View>
                  <View style={styles.recipePercentage}>
                    <Text style={styles.percentageText}>{item.percentage}%</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Dinner Wishes Modal */}
      <Modal
        visible={showWishModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWishModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowWishModal(false)}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Dinner Wishes</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.wishCounter}>
            <Text style={styles.wishCounterText}>
              {pendingCount}/{maxWishes} wishes used
            </Text>
          </View>

          {allRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Recipes Yet</Text>
              <Text style={styles.emptySubtitle}>
                Ask an adult to add some recipes to the household
              </Text>
            </View>
          ) : (
            <FlatList
              data={allRecipes}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.recipeList}
              renderItem={({ item }) => {
                const isWished = myWishes.some(w => w.recipe_id === item.id);
                
                return (
                  <TouchableOpacity 
                    style={[styles.wishRecipeCard, isWished && styles.wishedCard]}
                    onPress={() => !isWished && handleAddWish(item)}
                    disabled={addingWish || isWished}
                  >
                    {/* Recipe Image or Icon */}
                    {item.image ? (
                      <Image 
                        source={{ uri: item.image }} 
                        style={styles.wishRecipeImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.wishRecipeIconPlaceholder}>
                        <Ionicons name="restaurant" size={24} color={colors.textMuted} />
                      </View>
                    )}
                    
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeName}>{item.name}</Text>
                      <Text style={styles.recipeIngredients}>
                        {item.ingredients.length} ingredients
                      </Text>
                    </View>
                    {isWished ? (
                      <View style={styles.wishedBadge}>
                        <Ionicons name="heart" size={16} color={colors.white} />
                        <Text style={styles.wishedText}>Wished</Text>
                      </View>
                    ) : (
                      <View style={styles.addWishBtn}>
                        <Ionicons name="heart-outline" size={20} color={colors.danger} />
                        <Text style={styles.addWishText}>Wish</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  greeting: {
    ...typography.h2,
  },
  householdName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    padding: spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  wishesSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  wishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  wishName: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.sm,
  },
  buttonsContainer: {
    gap: spacing.lg,
  },
  bigButton: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.lg,
  },
  cookButton: {
    backgroundColor: colors.primary,
  },
  wishButton: {
    backgroundColor: colors.secondary,
  },
  buttonIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bigButtonTitle: {
    ...typography.h2,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  bigButtonSubtitle: {
    ...typography.body,
    color: colors.white,
    opacity: 0.8,
  },
  noHouseholdCard: {
    backgroundColor: colors.warning + '20',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  noHouseholdText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  joinBtn: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  joinBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
  },
  wishCounter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.secondary + '20',
  },
  wishCounterText: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  recipeList: {
    padding: spacing.lg,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    ...typography.body,
    fontWeight: '600',
  },
  recipeIngredients: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recipePercentage: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  percentageText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '600',
  },
  wishRecipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  wishRecipeImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  wishRecipeIconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  wishedCard: {
    backgroundColor: colors.danger + '10',
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  addWishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  addWishText: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '600',
  },
  wishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  wishedText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

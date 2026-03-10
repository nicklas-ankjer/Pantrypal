import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/components/theme';
import { recipesApi, shoppingListApi } from '../../src/api/client';
import { useAppStore } from '../../src/store/appStore';
import { IngredientAvailability, IngredientLocationInfo } from '../../src/types';

interface LocationChoice {
  ingredient_name: string;
  item_id: string;
}

interface MissingIngredient {
  name: string;
  quantity: number;
  unit: string;
}

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
  
  // Location selection state
  const [locationChoices, setLocationChoices] = useState<Record<string, string>>({});
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientAvailability | null>(null);

  // Store selection for missing ingredients
  const [showStoreSelectModal, setShowStoreSelectModal] = useState(false);
  const [missingIngredients, setMissingIngredients] = useState<MissingIngredient[]>([]);
  const [stores, setStores] = useState<string[]>(['Any Store']);
  const [selectedStore, setSelectedStore] = useState('Any Store');

  useEffect(() => {
    loadRecipe();
    fetchStores();
  }, [id]);

  // Fetch stores from API
  const fetchStores = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/stores`);
      const data = await response.json();
      if (data.stores && data.stores.length > 0) {
        setStores(data.stores);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

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
      
      // Initialize location choices with first available location for each ingredient
      const initialChoices: Record<string, string> = {};
      for (const ing of availRes.data.ingredients) {
        if (ing.locations && ing.locations.length > 0) {
          // Find the first location with enough quantity, or the one with most quantity
          const locWithEnough = ing.locations.find((loc: IngredientLocationInfo) => loc.quantity >= ing.required);
          if (locWithEnough) {
            initialChoices[ing.ingredient] = locWithEnough.item_id;
          } else {
            // Pick the one with highest quantity
            const sorted = [...ing.locations].sort((a: IngredientLocationInfo, b: IngredientLocationInfo) => b.quantity - a.quantity);
            if (sorted.length > 0) {
              initialChoices[ing.ingredient] = sorted[0].item_id;
            }
          }
        }
      }
      setLocationChoices(initialChoices);
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

    // Prepare missing ingredients and show store selection modal
    const ingredients = missing.map(m => ({
      name: m.ingredient,
      quantity: Math.max(0.1, m.required - m.available),
      unit: m.unit,
    }));
    
    setMissingIngredients(ingredients);
    setSelectedStore('Any Store');
    setShowStoreSelectModal(true);
  };

  // Actually add items to shopping list with selected store
  const confirmAddMissingToList = async () => {
    setCooking(true);
    setShowStoreSelectModal(false);
    
    try {
      // Add store to each ingredient
      const ingredientsWithStore = missingIngredients.map(ing => ({
        ...ing,
        store: selectedStore,
      }));
      console.log('Adding missing ingredients with store:', ingredientsWithStore);
      await shoppingListApi.addMissing(ingredientsWithStore);
      await fetchShoppingList();
      Alert.alert('Added!', `${missingIngredients.length} missing ingredient${missingIngredients.length !== 1 ? 's' : ''} added to "${selectedStore}"`);
      setMissingIngredients([]);
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
      // Build location choices array from state
      const choices: LocationChoice[] = Object.entries(locationChoices).map(([ingredient_name, item_id]) => ({
        ingredient_name,
        item_id,
      }));
      
      const result = await recipesApi.cook(id!, false, choices);
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
  
  // Handler for opening location selection modal
  const handleIngredientPress = (ing: IngredientAvailability) => {
    if (ing.locations && ing.locations.length > 1) {
      setSelectedIngredient(ing);
      setShowLocationModal(true);
    }
  };
  
  // Handler for selecting a location
  const handleSelectLocation = (ing: IngredientAvailability, itemId: string) => {
    setLocationChoices(prev => ({
      ...prev,
      [ing.ingredient]: itemId
    }));
    setShowLocationModal(false);
    setSelectedIngredient(null);
  };
  
  // Get the currently selected location info for an ingredient
  const getSelectedLocation = (ing: IngredientAvailability): IngredientLocationInfo | undefined => {
    if (!ing.locations || ing.locations.length === 0) return undefined;
    const chosenId = locationChoices[ing.ingredient];
    if (chosenId) {
      return ing.locations.find(loc => loc.item_id === chosenId);
    }
    return ing.locations[0];
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
          {availability.map((ing, index) => {
            const hasMultipleLocations = ing.locations && ing.locations.length > 1;
            const selectedLoc = getSelectedLocation(ing);
            
            return (
              <Pressable 
                key={index} 
                style={[styles.ingredientCard, hasMultipleLocations && styles.ingredientCardTappable]}
                onPress={() => handleIngredientPress(ing)}
              >
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
                    {/* Show selected location if multiple exist */}
                    {hasMultipleLocations && selectedLoc && (
                      <View style={styles.locationSelector}>
                        <Ionicons name="location-outline" size={12} color={colors.primary} />
                        <Text style={styles.locationText}>
                          {selectedLoc.location} ({selectedLoc.quantity} {ing.unit})
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={colors.primary} />
                      </View>
                    )}
                    {/* Show single location info if only one */}
                    {ing.locations && ing.locations.length === 1 && (
                      <View style={styles.singleLocation}>
                        <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.singleLocationText}>
                          {ing.locations[0].location}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.ingredientRight}>
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
                  {hasMultipleLocations && (
                    <Text style={styles.tapToChange}>Tap to change</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
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

      {/* Location Selection Modal */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowLocationModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Choose Location</Text>
            {selectedIngredient && (
              <>
                <Text style={styles.modalSubtitle}>
                  Where should {selectedIngredient.ingredient} be taken from?
                </Text>
                <View style={styles.locationOptions}>
                  {selectedIngredient.locations?.map((loc) => {
                    const isSelected = locationChoices[selectedIngredient.ingredient] === loc.item_id;
                    const hasEnough = loc.quantity >= selectedIngredient.required;
                    
                    return (
                      <TouchableOpacity
                        key={loc.item_id}
                        style={[
                          styles.locationOption,
                          isSelected && styles.locationOptionSelected,
                          !hasEnough && styles.locationOptionInsufficient
                        ]}
                        onPress={() => handleSelectLocation(selectedIngredient, loc.item_id)}
                      >
                        <View style={styles.locationOptionLeft}>
                          <Ionicons 
                            name={isSelected ? 'radio-button-on' : 'radio-button-off'} 
                            size={20} 
                            color={isSelected ? colors.primary : colors.textMuted} 
                          />
                          <View style={styles.locationOptionInfo}>
                            <Text style={[
                              styles.locationOptionName,
                              isSelected && styles.locationOptionNameSelected
                            ]}>
                              {loc.location}
                            </Text>
                            <Text style={styles.locationOptionQty}>
                              Available: {loc.quantity} {selectedIngredient.unit}
                            </Text>
                          </View>
                        </View>
                        {!hasEnough && (
                          <View style={styles.insufficientBadge}>
                            <Text style={styles.insufficientText}>Not enough</Text>
                          </View>
                        )}
                        {hasEnough && isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={() => setShowLocationModal(false)}
                >
                  <Text style={styles.modalDoneText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Store Selection Modal for Missing Ingredients */}
      <Modal
        visible={showStoreSelectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStoreSelectModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowStoreSelectModal(false)}
        >
          <Pressable style={styles.storeSelectModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.storeSelectHeader}>
              <Ionicons name="cart" size={24} color={colors.primary} />
              <Text style={styles.modalTitle}>Add to Shopping List</Text>
            </View>
            
            <Text style={styles.storeSelectSubtitle}>
              {missingIngredients.length} ingredient{missingIngredients.length !== 1 ? 's' : ''} will be added
            </Text>

            {/* Preview of items being added */}
            <View style={styles.ingredientPreview}>
              {missingIngredients.slice(0, 3).map((ing, index) => (
                <Text key={index} style={styles.ingredientPreviewText}>
                  • {ing.name} ({ing.quantity} {ing.unit})
                </Text>
              ))}
              {missingIngredients.length > 3 && (
                <Text style={styles.ingredientPreviewMore}>
                  +{missingIngredients.length - 3} more...
                </Text>
              )}
            </View>

            <Text style={styles.storeSelectLabel}>Select store:</Text>
            
            <ScrollView style={styles.storeSelectList} showsVerticalScrollIndicator={false}>
              {stores.map((store) => (
                <TouchableOpacity
                  key={store}
                  style={[
                    styles.storeSelectOption,
                    selectedStore === store && styles.storeSelectOptionActive
                  ]}
                  onPress={() => setSelectedStore(store)}
                >
                  <View style={styles.storeSelectOptionLeft}>
                    <Ionicons 
                      name={selectedStore === store ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={selectedStore === store ? colors.primary : colors.textMuted} 
                    />
                    <View style={styles.storeSelectIcon}>
                      <Ionicons 
                        name="storefront" 
                        size={18} 
                        color={selectedStore === store ? colors.primary : colors.secondary} 
                      />
                    </View>
                    <Text style={[
                      styles.storeSelectOptionText,
                      selectedStore === store && styles.storeSelectOptionTextActive
                    ]}>
                      {store}
                    </Text>
                  </View>
                  {selectedStore === store && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.storeSelectButtons}>
              <TouchableOpacity
                style={styles.storeSelectCancelBtn}
                onPress={() => {
                  setShowStoreSelectModal(false);
                  setMissingIngredients([]);
                }}
              >
                <Text style={styles.storeSelectCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.storeSelectConfirmBtn}
                onPress={confirmAddMissingToList}
              >
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.storeSelectConfirmText}>Add to List</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
  // New styles for location selection
  ingredientCardTappable: {
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  ingredientRight: {
    alignItems: 'flex-end',
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  locationText: {
    ...typography.caption,
    color: colors.primary,
    marginHorizontal: 4,
    fontSize: 11,
  },
  singleLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  singleLocationText: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 4,
    fontSize: 11,
  },
  tapToChange: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 10,
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  locationOptions: {
    gap: spacing.sm,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  locationOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  locationOptionInsufficient: {
    opacity: 0.7,
  },
  locationOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationOptionInfo: {
    marginLeft: spacing.sm,
  },
  locationOptionName: {
    ...typography.body,
    fontWeight: '500',
  },
  locationOptionNameSelected: {
    color: colors.primary,
  },
  locationOptionQty: {
    ...typography.caption,
    marginTop: 2,
  },
  insufficientBadge: {
    backgroundColor: colors.danger + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  insufficientText: {
    ...typography.caption,
    color: colors.danger,
    fontSize: 10,
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalDoneText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  // Store Selection Modal styles
  storeSelectModal: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
  },
  storeSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  storeSelectSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  ingredientPreview: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  ingredientPreviewText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ingredientPreviewMore: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  storeSelectLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  storeSelectList: {
    maxHeight: 200,
  },
  storeSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeSelectOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  storeSelectOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  storeSelectIcon: {
    marginLeft: spacing.xs,
  },
  storeSelectOptionText: {
    ...typography.body,
    fontWeight: '500',
  },
  storeSelectOptionTextActive: {
    color: colors.primary,
  },
  storeSelectButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  storeSelectCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  storeSelectCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  storeSelectConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  storeSelectConfirmText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
});

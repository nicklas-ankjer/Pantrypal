import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../src/components/theme';
import { useAppStore } from '../src/store/appStore';
import { ShoppingListItem, HomeStockItem } from '../src/types';

export default function ShoppingListScreen() {
  const router = useRouter();
  const { editItemId } = useLocalSearchParams<{ editItemId?: string }>();
  const insets = useSafeAreaInsets();
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('pieces');
  const [newItemLocation, setNewItemLocation] = useState('Uncategorized');
  const [newItemStore, setNewItemStore] = useState('Any Store');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locations, setLocations] = useState<string[]>(['Uncategorized']);
  const [stores, setStores] = useState<string[]>(['Any Store']);
  const [groupByStore, setGroupByStore] = useState(true);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShoppingListItem | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editLocation, setEditLocation] = useState('Uncategorized');
  const [editStore, setEditStore] = useState('Any Store');
  const [isSaving, setIsSaving] = useState(false);
  
  // Store management modal
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  
  const {
    shoppingList,
    homeStock,
    emergencyStock,
    fetchShoppingList,
    fetchHomeStock,
    fetchEmergencyStock,
    addShoppingListItem,
    updateShoppingListItem,
    deleteShoppingListItem,
    moveCheckedToStock,
    loading,
  } = useAppStore();

  // Fetch locations from API
  const fetchLocations = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/locations`);
      const data = await response.json();
      if (data.locations && data.locations.length > 0) {
        setLocations(data.locations);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

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

  useEffect(() => {
    fetchShoppingList();
    fetchHomeStock();
    fetchEmergencyStock();
    fetchLocations();
    fetchStores();
  }, []);

  // Auto-open edit modal if editItemId is passed
  useEffect(() => {
    if (editItemId && shoppingList.length > 0) {
      const itemToEdit = shoppingList.find(item => item.id === editItemId);
      if (itemToEdit) {
        setSelectedItem(itemToEdit);
        setEditQuantity(itemToEdit.quantity.toString());
        setEditUnit(itemToEdit.unit);
        setEditLocation(itemToEdit.location || 'Uncategorized');
        setEditStore(itemToEdit.store || 'Any Store');
        setEditModalVisible(true);
      }
    }
  }, [editItemId, shoppingList]);

  // Group shopping list by store
  const groupedByStore = useMemo(() => {
    const groups: { [key: string]: ShoppingListItem[] } = {};
    shoppingList.forEach(item => {
      const store = item.store || 'Any Store';
      if (!groups[store]) {
        groups[store] = [];
      }
      groups[store].push(item);
    });
    return groups;
  }, [shoppingList]);

  // Get suggestions from home stock and emergency stock based on input
  const suggestions = useMemo(() => {
    if (!newItemName || newItemName.length < 1) return [];
    
    const searchTerm = newItemName.toLowerCase();
    const allItems = [
      ...homeStock.map(item => ({ ...item, source: 'home' })),
      ...emergencyStock.map(item => ({ ...item, source: 'emergency' })),
    ];
    
    // Filter items that match the search term
    const matches = allItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm)
    );
    
    // Remove duplicates by name (case insensitive)
    const uniqueMatches = matches.reduce((acc, item) => {
      const nameKey = item.name.toLowerCase();
      if (!acc.find(i => i.name.toLowerCase() === nameKey)) {
        acc.push(item);
      }
      return acc;
    }, [] as typeof matches);
    
    return uniqueMatches.slice(0, 5); // Limit to 5 suggestions
  }, [newItemName, homeStock, emergencyStock]);

  const handleSelectSuggestion = (item: any) => {
    setNewItemName(item.name);
    setNewItemUnit(item.unit);
    setShowSuggestions(false);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    
    try {
      await addShoppingListItem({
        name: newItemName.trim(),
        quantity: parseFloat(newItemQty) || 1,
        unit: newItemUnit,
        location: newItemLocation,
        store: newItemStore,
      });
      
      setNewItemName('');
      setNewItemQty('1');
      setNewItemLocation('Uncategorized');
      setNewItemStore('Any Store');
      setShowAddForm(false);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Add item error:', error);
      Alert.alert('Error', 'Failed to add item');
    }
  };

  // Handle adding a new store
  const handleAddStore = async () => {
    if (!newStoreName.trim()) {
      Alert.alert('Error', 'Please enter a store name');
      return;
    }
    
    try {
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/stores?name=${encodeURIComponent(newStoreName.trim())}`, {
        method: 'POST',
      });
      await fetchStores();
      setNewStoreName('');
      setShowStoreModal(false);
    } catch (error) {
      console.error('Add store error:', error);
      Alert.alert('Error', 'Failed to add store');
    }
  };

  const handleToggleCheck = async (item: ShoppingListItem) => {
    try {
      await updateShoppingListItem(item.id, { checked: !item.checked });
    } catch (error) {
      console.error('Toggle check error:', error);
    }
  };

  const handleDelete = async (item: ShoppingListItem) => {
    try {
      await deleteShoppingListItem(item.id);
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleItemPress = (item: ShoppingListItem) => {
    setSelectedItem(item);
    setEditQuantity(item.quantity.toString());
    setEditUnit(item.unit);
    setEditLocation(item.location || 'Uncategorized');
    setEditStore(item.store || 'Any Store');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    
    const newQty = parseFloat(editQuantity);
    if (isNaN(newQty) || newQty <= 0) {
      Alert.alert('Invalid', 'Please enter a valid quantity');
      return;
    }

    setIsSaving(true);
    try {
      await updateShoppingListItem(selectedItem.id, { 
        quantity: newQty,
        unit: editUnit,
        location: editLocation,
        store: editStore
      });
      setEditModalVisible(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveToStock = async () => {
    const checkedCount = shoppingList.filter(i => i.checked).length;
    if (checkedCount === 0) {
      Alert.alert('No Items Checked', 'Check off items you\'ve purchased to move them to stock.');
      return;
    }
    
    setIsMoving(true);
    try {
      await moveCheckedToStock();
      await fetchHomeStock();
      await fetchShoppingList();
      Alert.alert('Success', `Moved ${checkedCount} item${checkedCount !== 1 ? 's' : ''} to Home Stock!`);
    } catch (error) {
      console.error('Move to stock error:', error);
      Alert.alert('Error', 'Failed to move items to stock. Please try again.');
    } finally {
      setIsMoving(false);
    }
  };

  const uncheckedItems = shoppingList.filter(i => !i.checked);
  const checkedItems = shoppingList.filter(i => i.checked);

  const renderItem = ({ item }: { item: ShoppingListItem }) => (
    <Pressable 
      style={[styles.itemCard, item.checked && styles.checkedCard]}
      onPress={() => handleItemPress(item)}
    >
      <Pressable
        style={styles.checkbox}
        onPress={(e) => {
          e.stopPropagation();
          handleToggleCheck(item);
        }}
      >
        <View style={[styles.checkboxInner, item.checked && styles.checkboxChecked]}>
          {item.checked && <Ionicons name="checkmark" size={16} color={colors.white} />}
        </View>
      </Pressable>
      
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, item.checked && styles.checkedText]}>
          {item.name}
        </Text>
        <Text style={[styles.itemQty, item.checked && styles.checkedText]}>
          {item.quantity} {item.unit}
        </Text>
        <View style={styles.itemBadges}>
          {item.store && item.store !== 'Any Store' && (
            <View style={styles.itemStoreBadge}>
              <Ionicons name="storefront-outline" size={12} color={colors.secondary} />
              <Text style={styles.itemStoreText}>{item.store}</Text>
            </View>
          )}
          {item.location && item.location !== 'Uncategorized' && (
            <View style={styles.itemLocationBadge}>
              <Ionicons name="location-outline" size={12} color={colors.primary} />
              <Text style={styles.itemLocationText}>{item.location}</Text>
            </View>
          )}
        </View>
        <Text style={styles.tapHint}>Tap to edit</Text>
      </View>
      
      <Pressable
        style={styles.deleteBtn}
        onPress={(e) => {
          e.stopPropagation();
          handleDelete(item);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={24} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );

  const units = ['pieces', 'grams', 'liters', 'kg', 'ml'];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Shopping List</Text>
        <Pressable onPress={() => setShowAddForm(!showAddForm)}>
          <Ionicons
            name={showAddForm ? 'close-circle' : 'add-circle'}
            size={28}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {/* Add Form with Autocomplete */}
      {showAddForm && (
        <View style={styles.addForm}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Item name"
              placeholderTextColor={colors.textMuted}
              value={newItemName}
              onChangeText={(text) => {
                setNewItemName(text);
                setShowSuggestions(text.length > 0);
              }}
              autoFocus
            />
            
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Suggestions from your stock:</Text>
                {suggestions.map((item, index) => (
                  <Pressable
                    key={`${item.id}-${index}`}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(item)}
                  >
                    <Ionicons 
                      name={item.source === 'home' ? 'cube-outline' : 'medkit-outline'} 
                      size={18} 
                      color={colors.primary} 
                    />
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    <Text style={styles.suggestionUnit}>({item.unit})</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          
          <View style={styles.addFormRow}>
            <TextInput
              style={[styles.input, styles.qtyInput]}
              placeholder="Qty"
              placeholderTextColor={colors.textMuted}
              value={newItemQty}
              onChangeText={setNewItemQty}
              keyboardType="numeric"
            />
            <View style={styles.unitSelector}>
              {units.map((unit) => (
                <Pressable
                  key={unit}
                  style={[styles.unitBtn, newItemUnit === unit && styles.unitBtnActive]}
                  onPress={() => setNewItemUnit(unit)}
                >
                  <Text style={[styles.unitText, newItemUnit === unit && styles.unitTextActive]}>
                    {unit}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          
          {/* Location selector for add form */}
          <Text style={styles.locationLabel}>Store in location:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.locationScroll}
            contentContainerStyle={styles.locationScrollContent}
          >
            {locations.map((loc) => (
              <Pressable
                key={loc}
                style={[styles.locationChip, newItemLocation === loc && styles.locationChipActive]}
                onPress={() => setNewItemLocation(loc)}
              >
                <Ionicons 
                  name={newItemLocation === loc ? 'location' : 'location-outline'} 
                  size={14} 
                  color={newItemLocation === loc ? colors.white : colors.primary} 
                />
                <Text style={[styles.locationChipText, newItemLocation === loc && styles.locationChipTextActive]}>
                  {loc}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          
          {/* Store selector for add form */}
          <View style={styles.storeLabelRow}>
            <Text style={styles.locationLabel}>Buy from store:</Text>
            <Pressable onPress={() => setShowStoreModal(true)}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.locationScroll}
            contentContainerStyle={styles.locationScrollContent}
          >
            {stores.map((store) => (
              <Pressable
                key={store}
                style={[styles.storeChip, newItemStore === store && styles.storeChipActive]}
                onPress={() => setNewItemStore(store)}
              >
                <Ionicons 
                  name={newItemStore === store ? 'storefront' : 'storefront-outline'} 
                  size={14} 
                  color={newItemStore === store ? colors.white : colors.secondary} 
                />
                <Text style={[styles.storeChipText, newItemStore === store && styles.storeChipTextActive]}>
                  {store}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          
          <Pressable style={styles.addBtn} onPress={handleAddItem}>
            <Text style={styles.addBtnText}>Add to List</Text>
          </Pressable>
        </View>
      )}

      {loading && shoppingList.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : shoppingList.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Shopping List Empty</Text>
          <Text style={styles.emptySubtitle}>
            Add items to your shopping list
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Unchecked items grouped by store */}
          {uncheckedItems.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>To Buy ({uncheckedItems.length})</Text>
              {Object.entries(
                uncheckedItems.reduce((acc, item) => {
                  const store = item.store || 'Any Store';
                  if (!acc[store]) acc[store] = [];
                  acc[store].push(item);
                  return acc;
                }, {} as Record<string, ShoppingListItem[]>)
              )
                .sort(([a], [b]) => {
                  // "Any Store" goes to the end
                  if (a === 'Any Store') return 1;
                  if (b === 'Any Store') return -1;
                  return a.localeCompare(b);
                })
                .map(([store, items]) => (
                  <View key={store} style={styles.storeGroup}>
                    <View style={styles.storeHeader}>
                      <Ionicons name="storefront" size={18} color={colors.secondary} />
                      <Text style={styles.storeHeaderText}>{store}</Text>
                      <Text style={styles.storeItemCount}>({items.length})</Text>
                    </View>
                    {items.map((item) => (
                      <View key={item.id}>
                        {renderItem({ item })}
                      </View>
                    ))}
                  </View>
                ))}
            </>
          )}
          
          {/* Checked items (not grouped, just listed) */}
          {checkedItems.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, styles.checkedSectionLabel]}>
                Checked ({checkedItems.length})
              </Text>
              {checkedItems.map((item) => (
                <View key={item.id}>
                  {renderItem({ item })}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Bottom Actions - Always show when there are checked items */}
      {checkedItems.length > 0 && (
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            style={[styles.moveToStockBtn, isMoving && styles.moveToStockBtnDisabled]}
            onPress={handleMoveToStock}
            disabled={isMoving}
          >
            {isMoving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
                <Text style={styles.moveToStockText}>
                  Move {checkedItems.length} Checked to Stock
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Edit Quantity Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setEditModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit Item</Text>
            <Text style={styles.modalSubtitle}>{selectedItem?.name}</Text>
            
            <View style={styles.quantityInputContainer}>
              <TextInput
                style={styles.quantityInput}
                value={editQuantity}
                onChangeText={setEditQuantity}
                keyboardType="numeric"
                autoFocus
                selectTextOnFocus
              />
            </View>

            {/* Unit selector */}
            <Text style={styles.unitLabel}>Unit</Text>
            <View style={styles.modalUnitSelector}>
              {units.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.modalUnitBtn, editUnit === unit && styles.modalUnitBtnActive]}
                  onPress={() => setEditUnit(unit)}
                >
                  <Text style={[styles.modalUnitText, editUnit === unit && styles.modalUnitTextActive]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick amounts */}
            <View style={styles.quickAmounts}>
              {[0.5, 1, 2, 5, 10].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmountBtn}
                  onPress={() => setEditQuantity(amount.toString())}
                >
                  <Text style={styles.quickAmountText}>{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Location selector in edit modal */}
            <Text style={styles.unitLabel}>Store in location</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalLocationSelector}
            >
              {locations.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.modalLocationBtn, editLocation === loc && styles.modalLocationBtnActive]}
                  onPress={() => setEditLocation(loc)}
                >
                  <Ionicons 
                    name={editLocation === loc ? 'location' : 'location-outline'} 
                    size={14} 
                    color={editLocation === loc ? colors.white : colors.primary} 
                  />
                  <Text style={[styles.modalLocationText, editLocation === loc && styles.modalLocationTextActive]}>
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Store selector in edit modal */}
            <Text style={styles.unitLabel}>Buy from store</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalLocationSelector}
            >
              {stores.map((store) => (
                <TouchableOpacity
                  key={store}
                  style={[styles.modalStoreBtn, editStore === store && styles.modalStoreBtnActive]}
                  onPress={() => setEditStore(store)}
                >
                  <Ionicons 
                    name={editStore === store ? 'storefront' : 'storefront-outline'} 
                    size={14} 
                    color={editStore === store ? colors.white : colors.secondary} 
                  />
                  <Text style={[styles.modalStoreText, editStore === store && styles.modalStoreTextActive]}>
                    {store}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setEditModalVisible(false);
                  setSelectedItem(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Store Modal */}
      <Modal
        visible={showStoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStoreModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowStoreModal(false)}
        >
          <Pressable style={styles.editModal} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add New Store</Text>
            <Text style={styles.modalSubtitle}>Enter the store name</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Walmart, Costco"
              placeholderTextColor={colors.textMuted}
              value={newStoreName}
              onChangeText={setNewStoreName}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowStoreModal(false);
                  setNewStoreName('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddStore}
              >
                <Text style={styles.modalSaveText}>Add Store</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
  },
  addForm: {
    backgroundColor: colors.cardBackground,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inputContainer: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    marginTop: -spacing.sm,
    ...shadows.lg,
    zIndex: 100,
    maxHeight: 200,
  },
  suggestionsTitle: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionName: {
    ...typography.body,
    marginLeft: spacing.sm,
    flex: 1,
  },
  suggestionUnit: {
    ...typography.caption,
    color: colors.textMuted,
  },
  addFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  qtyInput: {
    width: 70,
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  unitBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  unitBtnActive: {
    backgroundColor: colors.primary,
  },
  unitText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  unitTextActive: {
    color: colors.white,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    zIndex: 1,
  },
  addBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 4,
  },
  sectionLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  itemCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  checkedCard: {
    opacity: 0.6,
    backgroundColor: colors.primaryLight + '20',
  },
  checkbox: {
    marginRight: spacing.md,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    ...typography.body,
    fontWeight: '500',
  },
  itemQty: {
    ...typography.caption,
    marginTop: 2,
  },
  tapHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
    fontSize: 11,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  deleteBtn: {
    padding: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  moveToStockBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  moveToStockBtnDisabled: {
    opacity: 0.7,
  },
  moveToStockText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
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
  },
  quantityInputContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  quantityInput: {
    ...typography.h1,
    fontSize: 36,
    textAlign: 'center',
    minWidth: 150,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: spacing.sm,
  },
  unitLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  modalUnitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  modalUnitBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    margin: 2,
  },
  modalUnitBtnActive: {
    backgroundColor: colors.primary,
  },
  modalUnitText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  modalUnitTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  quickAmountBtn: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    margin: 2,
    minWidth: 50,
    alignItems: 'center',
  },
  quickAmountText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  // Location picker styles for Add Form
  locationLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.textSecondary,
  },
  locationScroll: {
    marginBottom: spacing.sm,
  },
  locationScrollContent: {
    paddingRight: spacing.md,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  locationChipTextActive: {
    color: colors.white,
  },
  // Item location badge styles
  itemLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: colors.primaryLight + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  itemLocationText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: 4,
    fontSize: 11,
  },
  // Modal location selector styles
  modalLocationSelector: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  modalLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalLocationBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalLocationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  modalLocationTextActive: {
    color: colors.white,
  },
  // Store chip styles (add form)
  storeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  storeChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  storeChipTextActive: {
    color: colors.white,
  },
  // Item badges container
  itemBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  // Item store badge styles
  itemStoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  itemStoreText: {
    ...typography.caption,
    color: colors.secondary,
    marginLeft: 4,
    fontSize: 11,
  },
  // Modal store selector styles
  modalStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalStoreBtnActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  modalStoreText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  modalStoreTextActive: {
    color: colors.white,
  },
  // Modal input
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  // Store grouping styles
  scrollView: {
    flex: 1,
  },
  storeGroup: {
    marginBottom: spacing.lg,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.secondary + '15',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  storeHeaderText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  storeItemCount: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  checkedSectionLabel: {
    marginTop: spacing.lg,
    color: colors.textMuted,
  },
});

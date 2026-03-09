import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/components/theme';
import { useAppStore } from '../../src/store/appStore';
import { homeStockApi } from '../../src/api/client';
import { HomeStockItem } from '../../src/types';

export default function HomeStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set(['Uncategorized']));
  const [locations, setLocations] = useState<string[]>(['Uncategorized']);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HomeStockItem | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Add location modal
  const [addLocationModalVisible, setAddLocationModalVisible] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  
  // Edit location modal
  const [editLocationModalVisible, setEditLocationModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [editLocationName, setEditLocationName] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  
  const { homeStock, fetchHomeStock, deleteHomeStockItem, updateHomeStockItem, quickAddHomeStock, loading } = useAppStore();

  useEffect(() => {
    fetchHomeStock();
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const response = await homeStockApi.getLocations();
      setLocations(response.data.locations);
      // Expand all locations by default
      setExpandedLocations(new Set(response.data.locations));
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomeStock();
    await loadLocations();
    setRefreshing(false);
  };

  // Group items by location
  const itemsByLocation = useMemo(() => {
    const grouped: { [key: string]: HomeStockItem[] } = {};
    
    // Initialize all known locations
    locations.forEach(loc => {
      grouped[loc] = [];
    });
    
    // Group items
    homeStock.forEach(item => {
      const loc = item.location || 'Uncategorized';
      if (!grouped[loc]) {
        grouped[loc] = [];
      }
      grouped[loc].push(item);
    });
    
    return grouped;
  }, [homeStock, locations]);

  const toggleLocation = (location: string) => {
    setExpandedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(location)) {
        newSet.delete(location);
      } else {
        newSet.add(location);
      }
      return newSet;
    });
  };

  const handleItemPress = (item: HomeStockItem) => {
    setSelectedItem(item);
    setEditQuantity(item.quantity.toString());
    setEditUnit(item.unit);
    setEditLocation(item.location || 'Uncategorized');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    
    const newQty = parseFloat(editQuantity);
    if (isNaN(newQty) || newQty < 0) {
      Alert.alert('Invalid', 'Please enter a valid quantity');
      return;
    }

    setIsSaving(true);
    try {
      await updateHomeStockItem(selectedItem.id, { 
        quantity: newQty,
        unit: editUnit,
        location: editLocation,
      });
      setEditModalVisible(false);
      setSelectedItem(null);
      await loadLocations();
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePress = (item: HomeStockItem) => {
    setSelectedItem(item);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!selectedItem) return;
    
    setIsDeleting(true);
    try {
      await deleteHomeStockItem(selectedItem.id);
      setDeleteModalVisible(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }
    
    try {
      await homeStockApi.createLocation(newLocationName.trim());
      await loadLocations();
      setAddLocationModalVisible(false);
      setNewLocationName('');
    } catch (error) {
      console.error('Failed to create location:', error);
      Alert.alert('Error', 'Failed to create location');
    }
  };

  const handleEditLocationPress = (location: string) => {
    if (location === 'Uncategorized') {
      Alert.alert('Cannot Edit', 'The Uncategorized location cannot be renamed.');
      return;
    }
    setSelectedLocation(location);
    setEditLocationName(location);
    setEditLocationModalVisible(true);
  };

  const handleSaveLocationName = async () => {
    if (!editLocationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }
    
    if (editLocationName.trim() === selectedLocation) {
      setEditLocationModalVisible(false);
      return;
    }
    
    setIsSavingLocation(true);
    try {
      await homeStockApi.renameLocation(selectedLocation, editLocationName.trim());
      await loadLocations();
      await fetchHomeStock();
      setEditLocationModalVisible(false);
      setSelectedLocation('');
      setEditLocationName('');
    } catch (error) {
      console.error('Failed to rename location:', error);
      Alert.alert('Error', 'Failed to rename location');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (selectedLocation === 'Uncategorized') {
      Alert.alert('Cannot Delete', 'The Uncategorized location cannot be deleted.');
      return;
    }
    
    const itemCount = (itemsByLocation[selectedLocation] || []).length;
    
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${selectedLocation}"?${itemCount > 0 ? ` ${itemCount} item(s) will be moved to Uncategorized.` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await homeStockApi.deleteLocation(selectedLocation);
              await loadLocations();
              await fetchHomeStock();
              setEditLocationModalVisible(false);
              setSelectedLocation('');
            } catch (error) {
              console.error('Failed to delete location:', error);
              Alert.alert('Error', 'Failed to delete location');
            }
          },
        },
      ]
    );
  };

  const getStockStatus = (item: HomeStockItem) => {
    if (item.safety_stock <= 0) return 'normal';
    if (item.quantity <= 0) return 'empty';
    if (item.quantity <= item.safety_stock) return 'low';
    return 'normal';
  };

  const units = ['pieces', 'grams', 'liters', 'kg', 'ml'];

  const renderItem = (item: HomeStockItem) => {
    const status = getStockStatus(item);
    
    return (
      <Pressable 
        key={item.id}
        style={[
          styles.itemCard,
          status === 'low' && styles.lowStockCard,
          status === 'empty' && styles.emptyStockCard,
        ]}
        onPress={() => handleItemPress(item)}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.name}</Text>
            {status !== 'normal' && (
              <View style={[
                styles.statusBadge,
                status === 'low' ? styles.lowBadge : styles.emptyBadge
              ]}>
                <Text style={styles.statusText}>
                  {status === 'low' ? 'Low' : 'Empty'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.itemQuantity}>
            {item.quantity} {item.unit}
            {item.safety_stock > 0 && (
              <Text style={styles.safetyText}>
                {' '}(Safety: {item.safety_stock})
              </Text>
            )}
          </Text>
          <Text style={styles.tapHint}>Tap to edit</Text>
        </View>
        
        <View style={styles.itemActions}>
          <View style={styles.quickButtons}>
            <Pressable
              style={styles.quickBtn}
              onPress={(e) => {
                e.stopPropagation();
                quickAddHomeStock(item.id, -1);
              }}
            >
              <Ionicons name="remove" size={20} color={colors.danger} />
            </Pressable>
            <Pressable
              style={styles.quickBtn}
              onPress={(e) => {
                e.stopPropagation();
                quickAddHomeStock(item.id, 1);
              }}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <Pressable
            style={styles.trashBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleDeletePress(item);
            }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderLocationSection = (location: string) => {
    const items = itemsByLocation[location] || [];
    const isExpanded = expandedLocations.has(location);
    
    return (
      <View key={location} style={styles.locationSection}>
        <Pressable 
          style={styles.locationHeader}
          onPress={() => toggleLocation(location)}
        >
          <View style={styles.locationLeft}>
            <Ionicons 
              name={isExpanded ? 'chevron-down' : 'chevron-forward'} 
              size={20} 
              color={colors.textPrimary} 
            />
            <Ionicons 
              name={location === 'Uncategorized' ? 'cube-outline' : 'folder-outline'} 
              size={20} 
              color={colors.primary}
              style={{ marginLeft: spacing.sm }}
            />
            <Text style={styles.locationName}>{location}</Text>
          </View>
          <View style={styles.locationRight}>
            {location !== 'Uncategorized' && (
              <Pressable
                style={styles.editLocationBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleEditLocationPress(location);
                }}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
              </Pressable>
            )}
            <View style={styles.locationBadge}>
              <Text style={styles.locationCount}>{items.length}</Text>
            </View>
          </View>
        </Pressable>
        
        {isExpanded && (
          <View style={styles.locationItems}>
            {items.length === 0 ? (
              <Text style={styles.emptyLocationText}>No items in this location</Text>
            ) : (
              items.map(item => renderItem(item))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Home Stock</Text>
          <Text style={styles.subtitle}>{homeStock.length} items in {locations.length} locations</Text>
        </View>
        <TouchableOpacity 
          style={styles.addLocationBtn}
          onPress={() => setAddLocationModalVisible(true)}
        >
          <Ionicons name="folder-open-outline" size={20} color={colors.primary} />
          <Text style={styles.addLocationText}>Add Location</Text>
        </TouchableOpacity>
      </View>

      {loading && homeStock.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
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
          {locations.map(location => renderLocationSection(location))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/add-home-stock')}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Edit Modal */}
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
            
            {/* Quantity */}
            <Text style={styles.fieldLabel}>Quantity</Text>
            <View style={styles.quantityInputContainer}>
              <TextInput
                style={styles.quantityInput}
                value={editQuantity}
                onChangeText={setEditQuantity}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>

            {/* Quick amounts */}
            <View style={styles.quickAmounts}>
              {[1, 5, 10, 50, 100].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmountBtn}
                  onPress={() => {
                    const current = parseFloat(editQuantity) || 0;
                    setEditQuantity((current + amount).toString());
                  }}
                >
                  <Text style={styles.quickAmountText}>+{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Unit selector */}
            <Text style={styles.fieldLabel}>Unit</Text>
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

            {/* Location selector */}
            <Text style={styles.fieldLabel}>Location</Text>
            <View style={styles.modalUnitSelector}>
              {locations.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.modalUnitBtn, editLocation === loc && styles.modalUnitBtnActive]}
                  onPress={() => setEditLocation(loc)}
                >
                  <Text style={[styles.modalUnitText, editLocation === loc && styles.modalUnitTextActive]}>
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setDeleteModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.deleteIconContainer}>
              <Ionicons name="trash" size={40} color={colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Delete Item?</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete "{selectedItem?.name}"?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setSelectedItem(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Location Modal */}
      <Modal
        visible={addLocationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddLocationModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setAddLocationModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add Location</Text>
            <Text style={styles.modalSubtitle}>Create a new storage location</Text>
            
            <TextInput
              style={styles.locationInput}
              placeholder="e.g., Freezer, Pantry, Fridge"
              placeholderTextColor={colors.textMuted}
              value={newLocationName}
              onChangeText={setNewLocationName}
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setAddLocationModalVisible(false);
                  setNewLocationName('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddLocation}
              >
                <Text style={styles.modalSaveText}>Create</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Location Modal */}
      <Modal
        visible={editLocationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditLocationModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setEditLocationModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit Location</Text>
            <Text style={styles.modalSubtitle}>Rename or delete this location</Text>
            
            <TextInput
              style={styles.locationInput}
              placeholder="Location name"
              placeholderTextColor={colors.textMuted}
              value={editLocationName}
              onChangeText={setEditLocationName}
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setEditLocationModalVisible(false);
                  setSelectedLocation('');
                  setEditLocationName('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveLocationName}
                disabled={isSavingLocation}
              >
                {isSavingLocation ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.deleteLocationBtn}
              onPress={handleDeleteLocation}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteLocationText}>Delete Location</Text>
            </TouchableOpacity>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  addLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  addLocationText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  locationSection: {
    marginBottom: spacing.md,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationName: {
    ...typography.h3,
    marginLeft: spacing.sm,
  },
  locationRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editLocationBtn: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  locationBadge: {
    backgroundColor: colors.primaryLight + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  locationCount: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  locationItems: {
    paddingLeft: spacing.md,
    paddingTop: spacing.sm,
  },
  emptyLocationText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  lowStockCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  emptyStockCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    ...typography.body,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  lowBadge: {
    backgroundColor: colors.warning + '30',
  },
  emptyBadge: {
    backgroundColor: colors.danger + '30',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  itemQuantity: {
    ...typography.bodySmall,
    marginTop: 4,
  },
  safetyText: {
    ...typography.caption,
  },
  tapHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
    fontSize: 11,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickButtons: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  quickBtn: {
    padding: spacing.sm,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashBtn: {
    padding: spacing.sm,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
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
    maxHeight: '80%',
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
  fieldLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  quantityInputContainer: {
    alignItems: 'center',
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
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
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
  modalUnitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    ...typography.caption,
    color: colors.textSecondary,
  },
  modalUnitTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  locationInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    marginTop: spacing.md,
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
  deleteIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  deleteModalText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  deleteLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteLocationText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginLeft: spacing.xs,
  },
});

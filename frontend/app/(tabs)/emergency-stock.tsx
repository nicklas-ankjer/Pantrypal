import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/components/theme';
import { useAppStore } from '../../src/store/appStore';
import { EmergencyStockItem } from '../../src/types';
import { format, differenceInDays, parseISO } from 'date-fns';

export default function EmergencyStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EmergencyStockItem | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editExpDate, setEditExpDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { emergencyStock, fetchEmergencyStock, deleteEmergencyStockItem, updateEmergencyStockItem, loading } = useAppStore();

  useEffect(() => {
    fetchEmergencyStock();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmergencyStock();
    setRefreshing(false);
  };

  const handleItemPress = (item: EmergencyStockItem) => {
    setSelectedItem(item);
    setEditQuantity(item.quantity.toString());
    setEditUnit(item.unit);
    setEditExpDate(format(parseISO(item.expiration_date), 'yyyy-MM-dd'));
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
      await updateEmergencyStockItem(selectedItem.id, { 
        quantity: newQty,
        unit: editUnit,
        expiration_date: new Date(editExpDate).toISOString(),
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

  const handleDeletePress = (item: EmergencyStockItem) => {
    setSelectedItem(item);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!selectedItem) return;
    
    setIsDeleting(true);
    try {
      await deleteEmergencyStockItem(selectedItem.id);
      setDeleteModalVisible(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const getExpirationStatus = (expirationDate: string) => {
    const days = differenceInDays(parseISO(expirationDate), new Date());
    if (days < 0) return { status: 'expired', days, color: colors.danger };
    if (days <= 7) return { status: 'critical', days, color: colors.danger };
    if (days <= 30) return { status: 'warning', days, color: colors.warning };
    return { status: 'ok', days, color: colors.primary };
  };

  const units = ['pieces', 'grams', 'liters', 'kg', 'ml'];

  const renderItem = ({ item }: { item: EmergencyStockItem }) => {
    const { status, days, color } = getExpirationStatus(item.expiration_date);
    
    return (
      <Pressable 
        style={[
          styles.itemCard,
          (status === 'expired' || status === 'critical') && styles.dangerCard,
          status === 'warning' && styles.warningCard,
        ]}
        onPress={() => handleItemPress(item)}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={[styles.expiryBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.expiryBadgeText, { color }]}>
                {status === 'expired' ? 'Expired' :
                  days === 0 ? 'Today' :
                  days === 1 ? 'Tomorrow' :
                  `${days}d`}
              </Text>
            </View>
          </View>
          <Text style={styles.itemQuantity}>
            {item.quantity} {item.unit}
          </Text>
          <Text style={styles.expiryDate}>
            Expires: {format(parseISO(item.expiration_date), 'MMM d, yyyy')}
          </Text>
          <Text style={styles.tapHint}>Tap to edit</Text>
        </View>
        
        <Pressable
          style={styles.deleteBtn}
          onPress={(e) => {
            e.stopPropagation();
            handleDeletePress(item);
          }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="medkit" size={24} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.title}>Emergency Stock</Text>
          <Text style={styles.subtitle}>Long-term preparedness supplies</Text>
        </View>
      </View>

      {loading && emergencyStock.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : emergencyStock.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Emergency Supplies</Text>
          <Text style={styles.emptySubtitle}>
            Track your emergency preparedness supplies with expiration dates
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/add-emergency-stock')}
          >
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.addButtonText}>Add Supply</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={colors.info} />
            <Text style={styles.infoText}>
              Items are sorted by expiration date (earliest first)
            </Text>
          </View>
          <FlatList
            data={emergencyStock}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          />
        </>
      )}

      {emergencyStock.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-emergency-stock')}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

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
              {[1, 2, 5, 10, 20].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmountBtn}
                  onPress={() => setEditQuantity(amount.toString())}
                >
                  <Text style={styles.quickAmountText}>{amount}</Text>
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

            {/* Expiration Date */}
            <Text style={styles.fieldLabel}>Expiration Date</Text>
            <TextInput
              style={styles.dateInput}
              value={editExpDate}
              onChangeText={setEditExpDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />

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
                style={[styles.modalSaveBtn, styles.deleteBtnStyle]}
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
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '15',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  infoText: {
    ...typography.caption,
    color: colors.info,
    marginLeft: spacing.xs,
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.xl * 3,
  },
  itemCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    ...typography.h3,
    flex: 1,
  },
  expiryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  expiryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemQuantity: {
    ...typography.body,
    marginTop: 4,
  },
  expiryDate: {
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  addButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
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
  dateInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    textAlign: 'center',
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
  deleteBtnStyle: {
    backgroundColor: colors.danger,
  },
});

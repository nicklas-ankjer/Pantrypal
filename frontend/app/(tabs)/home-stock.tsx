import React, { useEffect, useState } from 'react';
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
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/components/theme';
import { useAppStore } from '../../src/store/appStore';
import { HomeStockItem } from '../../src/types';

export default function HomeStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HomeStockItem | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  
  const { homeStock, fetchHomeStock, deleteHomeStockItem, updateHomeStockItem, quickAddHomeStock, loading } = useAppStore();

  useEffect(() => {
    fetchHomeStock();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomeStock();
    setRefreshing(false);
  };

  const handleDelete = async (item: HomeStockItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHomeStockItem(item.id);
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleItemPress = (item: HomeStockItem) => {
    setSelectedItem(item);
    setEditQuantity(item.quantity.toString());
    setEditModalVisible(true);
  };

  const handleSaveQuantity = async () => {
    if (!selectedItem) return;
    
    const newQty = parseFloat(editQuantity);
    if (isNaN(newQty) || newQty < 0) {
      Alert.alert('Invalid', 'Please enter a valid quantity');
      return;
    }

    try {
      await updateHomeStockItem(selectedItem.id, { quantity: newQty });
      setEditModalVisible(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const getStockStatus = (item: HomeStockItem) => {
    if (item.safety_stock <= 0) return 'normal';
    if (item.quantity <= 0) return 'empty';
    if (item.quantity <= item.safety_stock) return 'low';
    return 'normal';
  };

  const renderItem = ({ item }: { item: HomeStockItem }) => {
    const status = getStockStatus(item);
    
    return (
      <Pressable 
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
          <Text style={styles.tapHint}>Tap to edit quantity</Text>
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
            style={styles.deleteBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Home Stock</Text>
        <Text style={styles.subtitle}>{homeStock.length} items</Text>
      </View>

      {loading && homeStock.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : homeStock.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Items Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add items to track your household inventory
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/add-home-stock')}
          >
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.addButtonText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={homeStock}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {homeStock.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-home-stock')}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
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
            <Text style={styles.modalTitle}>Edit Quantity</Text>
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
              <Text style={styles.unitLabel}>{selectedItem?.unit}</Text>
            </View>

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

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveQuantity}
              >
                <Text style={styles.modalSaveText}>Save</Text>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
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
    ...typography.h3,
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
    ...typography.body,
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
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  quantityInput: {
    ...typography.h1,
    fontSize: 36,
    textAlign: 'center',
    minWidth: 120,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: spacing.sm,
  },
  unitLabel: {
    ...typography.h3,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
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
});

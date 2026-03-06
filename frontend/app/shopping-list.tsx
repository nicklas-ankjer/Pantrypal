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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../src/components/theme';
import { useAppStore } from '../src/store/appStore';
import { ShoppingListItem } from '../src/types';

export default function ShoppingListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('pieces');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const {
    shoppingList,
    fetchShoppingList,
    addShoppingListItem,
    updateShoppingListItem,
    deleteShoppingListItem,
    moveCheckedToStock,
    loading,
  } = useAppStore();

  useEffect(() => {
    fetchShoppingList();
  }, []);

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    
    await addShoppingListItem({
      name: newItemName.trim(),
      quantity: parseFloat(newItemQty) || 1,
      unit: newItemUnit,
    });
    
    setNewItemName('');
    setNewItemQty('1');
    setShowAddForm(false);
  };

  const handleToggleCheck = async (item: ShoppingListItem) => {
    await updateShoppingListItem(item.id, { checked: !item.checked });
  };

  const handleDelete = (item: ShoppingListItem) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from shopping list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteShoppingListItem(item.id),
        },
      ]
    );
  };

  const handleMoveToStock = async () => {
    const checkedCount = shoppingList.filter(i => i.checked).length;
    if (checkedCount === 0) {
      Alert.alert('No Items Checked', 'Check off items you\'ve purchased to move them to stock.');
      return;
    }
    
    Alert.alert(
      'Move to Stock',
      `Move ${checkedCount} checked item${checkedCount !== 1 ? 's' : ''} to Home Stock?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: async () => {
            await moveCheckedToStock();
            Alert.alert('Success', 'Items moved to Home Stock!');
          },
        },
      ]
    );
  };

  const uncheckedItems = shoppingList.filter(i => !i.checked);
  const checkedItems = shoppingList.filter(i => i.checked);

  const renderItem = ({ item }: { item: ShoppingListItem }) => (
    <View style={[styles.itemCard, item.checked && styles.checkedCard]}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => handleToggleCheck(item)}
      >
        <View style={[styles.checkboxInner, item.checked && styles.checkboxChecked]}>
          {item.checked && <Ionicons name="checkmark" size={16} color={colors.white} />}
        </View>
      </TouchableOpacity>
      
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, item.checked && styles.checkedText]}>
          {item.name}
        </Text>
        <Text style={[styles.itemQty, item.checked && styles.checkedText]}>
          {item.quantity} {item.unit}
        </Text>
      </View>
      
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item)}
      >
        <Ionicons name="close-circle" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  const units = ['pieces', 'grams', 'liters', 'kg', 'ml'];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Shopping List</Text>
        <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)}>
          <Ionicons
            name={showAddForm ? 'close-circle' : 'add-circle'}
            size={28}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Add Form */}
      {showAddForm && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Item name"
            placeholderTextColor={colors.textMuted}
            value={newItemName}
            onChangeText={setNewItemName}
            autoFocus
          />
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
                <TouchableOpacity
                  key={unit}
                  style={[styles.unitBtn, newItemUnit === unit && styles.unitBtnActive]}
                  onPress={() => setNewItemUnit(unit)}
                >
                  <Text style={[styles.unitText, newItemUnit === unit && styles.unitTextActive]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={handleAddItem}>
            <Text style={styles.addBtnText}>Add to List</Text>
          </TouchableOpacity>
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
        <FlatList
          data={[...uncheckedItems, ...checkedItems]}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            uncheckedItems.length > 0 && checkedItems.length > 0 ? (
              <Text style={styles.sectionLabel}>To Buy</Text>
            ) : null
          }
          stickyHeaderIndices={uncheckedItems.length > 0 && checkedItems.length > 0 ? [0] : []}
        />
      )}

      {/* Bottom Actions */}
      {checkedItems.length > 0 && (
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={styles.moveToStockBtn}
            onPress={handleMoveToStock}
          >
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
            <Text style={styles.moveToStockText}>Move Checked to Stock</Text>
          </TouchableOpacity>
        </View>
      )}
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
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  addFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    paddingVertical: spacing.xs,
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
  },
  checkbox: {
    marginRight: spacing.md,
  },
  checkboxInner: {
    width: 24,
    height: 24,
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
  checkedText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  deleteBtn: {
    padding: spacing.xs,
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
  },
  moveToStockText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});

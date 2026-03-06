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
  
  const { homeStock, fetchHomeStock, deleteHomeStockItem, quickAddHomeStock, loading } = useAppStore();

  useEffect(() => {
    fetchHomeStock();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomeStock();
    setRefreshing(false);
  };

  const handleDelete = (item: HomeStockItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteHomeStockItem(item.id),
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

  const renderItem = ({ item }: { item: HomeStockItem }) => {
    const status = getStockStatus(item);
    
    return (
      <View style={[
        styles.itemCard,
        status === 'low' && styles.lowStockCard,
        status === 'empty' && styles.emptyStockCard,
      ]}>
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
        </View>
        
        <View style={styles.itemActions}>
          <View style={styles.quickButtons}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => quickAddHomeStock(item.id, -1)}
            >
              <Ionicons name="remove" size={20} color={colors.danger} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => quickAddHomeStock(item.id, 1)}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
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
  },
  deleteBtn: {
    padding: spacing.sm,
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
});

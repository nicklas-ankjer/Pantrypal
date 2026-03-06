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
import { EmergencyStockItem } from '../../src/types';
import { format, differenceInDays, parseISO } from 'date-fns';

export default function EmergencyStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  
  const { emergencyStock, fetchEmergencyStock, deleteEmergencyStockItem, loading } = useAppStore();

  useEffect(() => {
    fetchEmergencyStock();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmergencyStock();
    setRefreshing(false);
  };

  const handleDelete = (item: EmergencyStockItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteEmergencyStockItem(item.id),
        },
      ]
    );
  };

  const getExpirationStatus = (expirationDate: string) => {
    const days = differenceInDays(parseISO(expirationDate), new Date());
    if (days < 0) return { status: 'expired', days, color: colors.danger };
    if (days <= 7) return { status: 'critical', days, color: colors.danger };
    if (days <= 30) return { status: 'warning', days, color: colors.warning };
    return { status: 'ok', days, color: colors.primary };
  };

  const renderItem = ({ item }: { item: EmergencyStockItem }) => {
    const { status, days, color } = getExpirationStatus(item.expiration_date);
    
    return (
      <View style={[
        styles.itemCard,
        (status === 'expired' || status === 'critical') && styles.dangerCard,
        status === 'warning' && styles.warningCard,
      ]}>
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
        </View>
        
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
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

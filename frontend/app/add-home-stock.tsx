import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../src/components/theme';
import { useAppStore } from '../src/store/appStore';

export default function AddHomeStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addHomeStockItem } = useAppStore();
  
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pieces');
  const [safetyStock, setSafetyStock] = useState('');
  const [saving, setSaving] = useState(false);

  const units = [
    { value: 'pieces', label: 'Pieces' },
    { value: 'grams', label: 'Grams (g)' },
    { value: 'liters', label: 'Liters (L)' },
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'ml', label: 'Milliliters (ml)' },
  ];

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    if (!quantity.trim() || isNaN(parseFloat(quantity))) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      await addHomeStockItem({
        name: name.trim(),
        quantity: parseFloat(quantity),
        unit,
        safety_stock: parseFloat(safetyStock) || 0,
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Item</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Item Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Milk, Pasta, Toilet Paper"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Unit</Text>
          <View style={styles.unitGrid}>
            {units.map((u) => (
              <TouchableOpacity
                key={u.value}
                style={[styles.unitOption, unit === u.value && styles.unitOptionActive]}
                onPress={() => setUnit(u.value)}
              >
                <Text style={[styles.unitOptionText, unit === u.value && styles.unitOptionTextActive]}>
                  {u.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Safety Stock Level</Text>
          <Text style={styles.labelHint}>
            You'll be notified when stock falls below this level
          </Text>
          <TextInput
            style={styles.input}
            placeholder="0 (optional)"
            placeholderTextColor={colors.textMuted}
            value={safetyStock}
            onChangeText={setSafetyStock}
            keyboardType="numeric"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Adding...' : 'Add to Stock'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  labelHint: {
    ...typography.caption,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  input: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  unitOption: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitOptionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  unitOptionTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
});

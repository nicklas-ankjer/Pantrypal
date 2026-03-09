import React, { useState, useEffect } from 'react';
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
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../src/components/theme';
import { useAppStore } from '../src/store/appStore';
import { homeStockApi } from '../src/api/client';

export default function AddHomeStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addHomeStockItem } = useAppStore();
  
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pieces');
  const [safetyStock, setSafetyStock] = useState('');
  const [location, setLocation] = useState('Uncategorized');
  const [locations, setLocations] = useState<string[]>(['Uncategorized']);
  const [saving, setSaving] = useState(false);
  
  // Add location modal
  const [addLocationModalVisible, setAddLocationModalVisible] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const response = await homeStockApi.getLocations();
      if (response.data.locations.length > 0) {
        setLocations(response.data.locations);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }
    
    try {
      await homeStockApi.createLocation(newLocationName.trim());
      const newLoc = newLocationName.trim();
      setLocations(prev => [...prev, newLoc].sort());
      setLocation(newLoc);
      setAddLocationModalVisible(false);
      setNewLocationName('');
    } catch (error) {
      console.error('Failed to create location:', error);
      Alert.alert('Error', 'Failed to create location');
    }
  };

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
        location: location,
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
          <View style={styles.labelRow}>
            <Text style={styles.label}>Location</Text>
            <TouchableOpacity 
              style={styles.addLocationLink}
              onPress={() => setAddLocationModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addLocationLinkText}>New Location</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.unitGrid}>
            {locations.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.unitOption, location === loc && styles.unitOptionActive]}
                onPress={() => setLocation(loc)}
              >
                <Ionicons 
                  name={loc === 'Uncategorized' ? 'cube-outline' : 'folder-outline'} 
                  size={14} 
                  color={location === loc ? colors.white : colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.unitOptionText, location === loc && styles.unitOptionTextActive]}>
                  {loc}
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  addLocationLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addLocationLinkText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
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
});

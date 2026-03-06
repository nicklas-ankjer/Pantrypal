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
import { colors, spacing, borderRadius, shadows, typography } from '../src/components/theme';
import { useAppStore } from '../src/store/appStore';
import { Ingredient } from '../src/types';

export default function AddRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRecipe } = useAppStore();
  
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('grams');
  const [saving, setSaving] = useState(false);

  const units = [
    { value: 'pieces', label: 'pcs' },
    { value: 'grams', label: 'g' },
    { value: 'liters', label: 'L' },
    { value: 'kg', label: 'kg' },
    { value: 'ml', label: 'ml' },
  ];

  const handleAddIngredient = () => {
    if (!newIngName.trim()) {
      Alert.alert('Error', 'Please enter ingredient name');
      return;
    }
    if (!newIngQty.trim() || isNaN(parseFloat(newIngQty))) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    setIngredients([...ingredients, {
      name: newIngName.trim(),
      quantity: parseFloat(newIngQty),
      unit: newIngUnit,
    }]);
    setNewIngName('');
    setNewIngQty('');
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a recipe name');
      return;
    }
    if (ingredients.length === 0) {
      Alert.alert('Error', 'Please add at least one ingredient');
      return;
    }

    setSaving(true);
    try {
      await addRecipe({
        name: name.trim(),
        ingredients,
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save recipe');
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
        <Text style={styles.title}>New Recipe</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Recipe Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Bolognese, Pancakes"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Ingredients *</Text>
          
          {/* Existing Ingredients */}
          {ingredients.map((ing, index) => (
            <View key={index} style={styles.ingredientItem}>
              <View style={styles.ingredientInfo}>
                <Text style={styles.ingredientName}>{ing.name}</Text>
                <Text style={styles.ingredientQty}>
                  {ing.quantity} {ing.unit}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveIngredient(index)}
                style={styles.removeBtn}
              >
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Ingredient Form */}
          <View style={styles.addIngredientForm}>
            <TextInput
              style={[styles.input, styles.ingNameInput]}
              placeholder="Ingredient name"
              placeholderTextColor={colors.textMuted}
              value={newIngName}
              onChangeText={setNewIngName}
            />
            <View style={styles.ingRow}>
              <TextInput
                style={[styles.input, styles.ingQtyInput]}
                placeholder="Qty"
                placeholderTextColor={colors.textMuted}
                value={newIngQty}
                onChangeText={setNewIngQty}
                keyboardType="numeric"
              />
              <View style={styles.unitPicker}>
                {units.map((u) => (
                  <TouchableOpacity
                    key={u.value}
                    style={[
                      styles.unitOption,
                      newIngUnit === u.value && styles.unitOptionActive,
                    ]}
                    onPress={() => setNewIngUnit(u.value)}
                  >
                    <Text
                      style={[
                        styles.unitOptionText,
                        newIngUnit === u.value && styles.unitOptionTextActive,
                      ]}
                    >
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={styles.addIngBtn}
              onPress={handleAddIngredient}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={styles.addIngBtnText}>Add Ingredient</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 'Save Recipe'}
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
  input: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  ingredientInfo: {
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
  removeBtn: {
    padding: spacing.xs,
  },
  addIngredientForm: {
    backgroundColor: colors.wood + '30',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  ingNameInput: {
    marginBottom: spacing.sm,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingQtyInput: {
    width: 70,
    marginRight: spacing.sm,
  },
  unitPicker: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  unitOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: colors.cardBackground,
  },
  unitOptionActive: {
    backgroundColor: colors.primary,
  },
  unitOptionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  unitOptionTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  addIngBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
  },
  addIngBtnText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: spacing.xs,
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

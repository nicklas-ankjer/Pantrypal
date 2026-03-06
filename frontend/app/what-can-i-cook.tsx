import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography } from '../src/components/theme';
import { recipesApi } from '../src/api/client';

interface RecipeSuggestion {
  id: string;
  name: string;
  available_ingredients: number;
  total_ingredients: number;
  percentage: number;
}

export default function WhatCanICookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [canCook, setCanCook] = useState<RecipeSuggestion[]>([]);
  const [partial, setPartial] = useState<RecipeSuggestion[]>([]);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const response = await recipesApi.whatCanICook();
      setCanCook(response.data.can_cook);
      setPartial(response.data.partial_ingredients);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderRecipe = ({ item }: { item: RecipeSuggestion }) => {
    const isComplete = item.percentage === 100;
    
    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => router.push(`/recipe/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.recipeLeft}>
          <View style={[
            styles.recipeIcon,
            isComplete ? styles.recipeIconReady : styles.recipeIconPartial
          ]}>
            <Ionicons
              name={isComplete ? 'checkmark-circle' : 'pie-chart'}
              size={24}
              color={isComplete ? colors.success : colors.warning}
            />
          </View>
          <View style={styles.recipeInfo}>
            <Text style={styles.recipeName}>{item.name}</Text>
            <Text style={styles.recipeStats}>
              {item.available_ingredients}/{item.total_ingredients} ingredients available
            </Text>
          </View>
        </View>
        
        <View style={styles.recipeRight}>
          {!isComplete && (
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>{item.percentage}%</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Checking your pantry...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>What Can I Cook?</Text>
        <View style={styles.placeholder} />
      </View>

      {canCook.length === 0 && partial.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Recipes Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add recipes and stock your pantry to see what you can cook
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/add-recipe'), 100);
            }}
          >
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.addButtonText}>Add Recipe</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[...canCook, ...partial]}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            canCook.length > 0 ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.sectionTitle}>Ready to Cook</Text>
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            partial.length > 0 ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Ionicons name="pie-chart" size={20} color={colors.warning} />
                  <Text style={styles.sectionTitle}>Partial Ingredients</Text>
                </View>
              </View>
            ) : null
          }
          stickyHeaderIndices={canCook.length > 0 ? [0] : []}
        />
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
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
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.background,
    paddingVertical: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    marginLeft: spacing.sm,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  recipeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recipeIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeIconReady: {
    backgroundColor: colors.success + '20',
  },
  recipeIconPartial: {
    backgroundColor: colors.warning + '20',
  },
  recipeInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  recipeName: {
    ...typography.h3,
  },
  recipeStats: {
    ...typography.caption,
    marginTop: 2,
  },
  recipeRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  percentText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
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
});

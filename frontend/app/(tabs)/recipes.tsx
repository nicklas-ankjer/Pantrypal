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
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/components/theme';
import { useAppStore } from '../../src/store/appStore';
import { useAuthStore } from '../../src/store/authStore';
import { Recipe } from '../../src/types';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function RecipesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  
  const { recipes, fetchRecipes, deleteRecipe, loading } = useAppStore();
  const { user } = useAuthStore();
  
  const isAdult = user?.role !== 'child';

  useEffect(() => {
    fetchRecipes();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
  };

  const handleDelete = (recipe: Recipe) => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRecipe(recipe.id),
        },
      ]
    );
  };

  const handleCameraPress = async (recipe: Recipe) => {
    // Show options: Take Photo, Choose from Library, View Image (if exists), Remove Image
    const options = [
      { text: 'Take Photo', onPress: () => takePhoto(recipe) },
      { text: 'Choose from Library', onPress: () => pickImage(recipe) },
    ];
    
    if (recipe.image) {
      options.push({ text: 'View Image', onPress: () => viewImage(recipe) });
      options.push({ text: 'Remove Image', onPress: () => removeImage(recipe) });
    }
    
    options.push({ text: 'Cancel', style: 'cancel' } as any);
    
    Alert.alert('Recipe Photo', `Add a photo for "${recipe.name}"`, options);
  };

  const takePhoto = async (recipe: Recipe) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      await uploadImage(recipe.id, result.assets[0].base64);
    }
  };

  const pickImage = async (recipe: Recipe) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Photo library access is needed');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      await uploadImage(recipe.id, result.assets[0].base64);
    }
  };

  const uploadImage = async (recipeId: string, base64Image: string) => {
    setUploadingImage(recipeId);
    try {
      await axios.put(`${API_BASE}/api/recipes/${recipeId}/image`, {
        image: `data:image/jpeg;base64,${base64Image}`,
      });
      await fetchRecipes();
      Alert.alert('Success', 'Recipe photo added!');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const viewImage = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowImageModal(true);
  };

  const removeImage = async (recipe: Recipe) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_BASE}/api/recipes/${recipe.id}/image`);
              await fetchRecipes();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove image');
            }
          },
        },
      ]
    );
  };

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => router.push(`/recipe/${item.id}`)}
      activeOpacity={0.7}
    >
      {/* Recipe Icon with Camera Overlay */}
      <View style={styles.iconContainer}>
        {item.image ? (
          <Image 
            source={{ uri: item.image }} 
            style={styles.recipeImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.recipeIcon}>
            <Ionicons name="restaurant" size={24} color={colors.primary} />
          </View>
        )}
        
        {/* Camera overlay badge for adults */}
        {isAdult && (
          <TouchableOpacity
            style={[styles.cameraBadge, item.image && styles.cameraBadgeWithImage]}
            onPress={(e) => {
              e.stopPropagation();
              handleCameraPress(item);
            }}
            disabled={uploadingImage === item.id}
          >
            {uploadingImage === item.id ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons 
                name={item.image ? "camera" : "camera-outline"} 
                size={14} 
                color={colors.white} 
              />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.recipeContent}>
        <Text style={styles.recipeName}>{item.name}</Text>
        <Text style={styles.recipeIngredients}>
          {item.ingredients.length} ingredient{item.ingredients.length !== 1 ? 's' : ''}
        </Text>
        {item.image && (
          <View style={styles.hasPhotoBadge}>
            <Ionicons name="image" size={10} color={colors.success} />
            <Text style={styles.hasPhotoText}>Has photo</Text>
          </View>
        )}
      </View>
      
      {isAdult && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipes</Text>
        <TouchableOpacity
          style={styles.whatCanICook}
          onPress={() => router.push('/what-can-i-cook')}
        >
          <Ionicons name="flame-outline" size={18} color={colors.primary} />
          <Text style={styles.whatCanICookText}>What can I cook?</Text>
        </TouchableOpacity>
      </View>

      {loading && recipes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>No recipes yet</Text>
              <Text style={styles.emptySubtext}>
                Add your first recipe to get started
              </Text>
            </View>
          }
        />
      )}

      {/* Add Recipe FAB - Adults only */}
      {isAdult && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-recipe')}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

      {/* Image View Modal */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <Pressable 
          style={styles.imageModalOverlay}
          onPress={() => setShowImageModal(false)}
        >
          <Pressable style={styles.imageModalContent} onPress={(e) => e.stopPropagation()}>
            {selectedRecipe?.image && (
              <>
                <Image 
                  source={{ uri: selectedRecipe.image }} 
                  style={styles.fullImage}
                  resizeMode="contain"
                />
                <Text style={styles.imageModalTitle}>{selectedRecipe.name}</Text>
              </>
            )}
            <TouchableOpacity
              style={styles.closeImageBtn}
              onPress={() => setShowImageModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.white} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h1,
  },
  whatCanICook: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  whatCanICookText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  iconContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  recipeIcon: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeImage: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.cardBackground,
  },
  cameraBadgeWithImage: {
    backgroundColor: colors.success,
  },
  recipeContent: {
    flex: 1,
  },
  recipeName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  recipeIngredients: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  hasPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  hasPhotoText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.success,
    marginLeft: 3,
  },
  deleteButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
  },
  emptyText: {
    ...typography.h2,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  // Image Modal styles
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '90%',
    height: '70%',
    borderRadius: borderRadius.lg,
  },
  imageModalTitle: {
    ...typography.h2,
    color: colors.white,
    marginTop: spacing.lg,
  },
  closeImageBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../src/components/theme';
import { useAuthStore } from '../src/store/authStore';
import { notificationService } from '../src/services/notificationService';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  
  const [emergencyAlerts, setEmergencyAlerts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const settings = await notificationService.getSettings(user.id);
      setEmergencyAlerts(settings.emergency_alerts_enabled);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmergencyAlerts = async (value: boolean) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to manage notification settings.');
      router.push('/auth');
      return;
    }

    setEmergencyAlerts(value);
    setSaving(true);
    
    try {
      await notificationService.updateSettings(user.id, {
        emergency_alerts_enabled: value,
      });
      
      if (value) {
        // Re-register for push notifications when enabling
        await notificationService.registerForPushNotifications(user.id);
      }
    } catch (error) {
      // Revert on error
      setEmergencyAlerts(!value);
      Alert.alert('Error', 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to test notifications.');
      router.push('/auth');
      return;
    }

    setTestingNotification(true);
    
    try {
      // First ensure we have a push token registered
      const token = await notificationService.registerForPushNotifications(user.id);
      
      if (!token) {
        Alert.alert(
          'Notification Permission Required',
          'Please allow notifications in your device settings to receive alerts.'
        );
        return;
      }

      const success = await notificationService.sendTestNotification(user.id);
      
      if (success) {
        Alert.alert('Success', 'Test notification sent! You should receive it shortly.');
      } else {
        Alert.alert('Error', 'Failed to send test notification');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    } finally {
      setTestingNotification(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            if (user) {
              await notificationService.unregisterPushToken(user.id);
            }
            logout();
            router.replace('/auth');
          }
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* User Info */}
        {user && (
          <View style={styles.card}>
            <View style={styles.userSection}>
              <Ionicons name="person-circle-outline" size={50} color={colors.primary} />
              <View style={styles.userInfo}>
                <Text style={styles.username}>{user.username}</Text>
                <Text style={styles.userSubtext}>
                  {user.household_id ? 'In a household' : 'No household'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Notifications Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Emergency Stock Alerts</Text>
                <Text style={styles.settingDescription}>
                  Get notified when items expire in 30, 14, or 7 days
                </Text>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={emergencyAlerts}
                onValueChange={handleToggleEmergencyAlerts}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={emergencyAlerts ? colors.primary : colors.textMuted}
                disabled={saving}
              />
            )}
          </View>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestNotification}
            disabled={testingNotification}
          >
            {testingNotification ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color={colors.primary} />
                <Text style={styles.testButtonText}>Send Test Notification</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Alert Schedule Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Alert Schedule</Text>
          <Text style={styles.infoText}>
            You'll receive notifications for Emergency Stock items at these intervals:
          </Text>
          
          <View style={styles.scheduleItem}>
            <View style={styles.scheduleIcon}>
              <Text style={styles.scheduleEmoji}>📅</Text>
            </View>
            <Text style={styles.scheduleText}>30 days before expiration</Text>
          </View>
          
          <View style={styles.scheduleItem}>
            <View style={styles.scheduleIcon}>
              <Text style={styles.scheduleEmoji}>⚠️</Text>
            </View>
            <Text style={styles.scheduleText}>14 days before expiration</Text>
          </View>
          
          <View style={styles.scheduleItem}>
            <View style={styles.scheduleIcon}>
              <Text style={styles.scheduleEmoji}>🚨</Text>
            </View>
            <Text style={styles.scheduleText}>7 days before expiration</Text>
          </View>
        </View>

        {/* Account Section */}
        {user && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/household')}
            >
              <Ionicons name="people-outline" size={24} color={colors.text} />
              <Text style={styles.menuItemText}>Manage Household</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.dangerItem]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={24} color={colors.danger} />
              <Text style={[styles.menuItemText, styles.dangerText]}>Sign Out</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* Not signed in */}
        {!user && (
          <View style={styles.card}>
            <View style={styles.signInPrompt}>
              <Ionicons name="person-outline" size={40} color={colors.textMuted} />
              <Text style={styles.signInText}>Sign in to manage your settings</Text>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push('/auth')}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: spacing.md,
  },
  username: {
    ...typography.h3,
  },
  userSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  settingText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  settingLabel: {
    ...typography.body,
    fontWeight: '500',
  },
  settingDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  testButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scheduleIcon: {
    width: 32,
    alignItems: 'center',
  },
  scheduleEmoji: {
    fontSize: 18,
  },
  scheduleText: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.md,
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: colors.danger,
  },
  signInPrompt: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  signInText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  signInButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  signInButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
});

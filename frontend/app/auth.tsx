import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../src/components/theme';
import { useAuthStore } from '../src/store/authStore';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type AuthMode = 'login' | 'register';
type UserRole = 'adult' | 'child';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, register, isAuthenticated, loading, error, clearError, user } = useAuthStore();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('adult');
  
  // Username availability check
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      // Route based on role
      if (user.role === 'child') {
        router.replace('/child-home');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  // Debounced username check
  useEffect(() => {
    if (mode !== 'register' || username.trim().length < 2) {
      setUsernameAvailable(null);
      setUsernameMessage('');
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await axios.get(`${API_BASE}/api/auth/check-username/${encodeURIComponent(username.trim())}`);
        setUsernameAvailable(response.data.available);
        setUsernameMessage(response.data.message);
      } catch (error) {
        console.error('Username check failed:', error);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, mode]);

  const handleSubmit = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      Alert.alert('Error', 'PIN must be exactly 4 digits');
      return;
    }

    if (mode === 'register') {
      // Check username availability before registering
      if (!usernameAvailable) {
        Alert.alert('Username Unavailable', 'Please choose a different username');
        return;
      }
      
      if (pin !== confirmPin) {
        Alert.alert('Error', 'PINs do not match');
        return;
      }
      const success = await register(username.trim(), pin, selectedRole);
      if (success) {
        if (selectedRole === 'child') {
          router.replace('/child-home');
        } else {
          router.replace('/(tabs)');
        }
      }
    } else {
      const success = await login(username.trim(), pin);
      // Navigation happens in useEffect based on role
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setPin('');
    setConfirmPin('');
    setSelectedRole('adult');
    setUsernameAvailable(null);
    setUsernameMessage('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="home-outline" size={60} color={colors.primary} />
          <Text style={styles.title}>Kitchen Counter</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Welcome back!' : 'Create your account'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Role Selection - Only for Register */}
          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>I am a...</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    selectedRole === 'adult' && styles.roleOptionActive
                  ]}
                  onPress={() => setSelectedRole('adult')}
                >
                  <Ionicons 
                    name="person" 
                    size={28} 
                    color={selectedRole === 'adult' ? colors.white : colors.primary} 
                  />
                  <Text style={[
                    styles.roleOptionText,
                    selectedRole === 'adult' && styles.roleOptionTextActive
                  ]}>
                    Adult
                  </Text>
                  <Text style={[
                    styles.roleOptionDesc,
                    selectedRole === 'adult' && styles.roleOptionDescActive
                  ]}>
                    Full access
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    selectedRole === 'child' && styles.roleOptionActiveChild
                  ]}
                  onPress={() => setSelectedRole('child')}
                >
                  <Ionicons 
                    name="happy" 
                    size={28} 
                    color={selectedRole === 'child' ? colors.white : colors.secondary} 
                  />
                  <Text style={[
                    styles.roleOptionText,
                    selectedRole === 'child' && styles.roleOptionTextActive
                  ]}>
                    Family Member
                  </Text>
                  <Text style={[
                    styles.roleOptionDesc,
                    selectedRole === 'child' && styles.roleOptionDescActive
                  ]}>
                    Simple view
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={[
              styles.inputWrapper,
              mode === 'register' && usernameAvailable === true && styles.inputValid,
              mode === 'register' && usernameAvailable === false && styles.inputInvalid,
            ]}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Choose a unique username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={20}
              />
              {mode === 'register' && username.length >= 2 && (
                <View style={styles.usernameStatus}>
                  {checkingUsername ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : usernameAvailable === true ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  ) : usernameAvailable === false ? (
                    <Ionicons name="close-circle" size={22} color={colors.danger} />
                  ) : null}
                </View>
              )}
            </View>
            {mode === 'register' && usernameMessage && !checkingUsername && (
              <Text style={[
                styles.usernameHint,
                usernameAvailable ? styles.usernameHintSuccess : styles.usernameHintError
              ]}>
                {usernameMessage}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>4-Digit PIN</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••"
                placeholderTextColor={colors.textMuted}
                value={pin}
                onChangeText={(text) => setPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />
            </View>
            <View style={styles.pinDots}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[styles.pinDot, pin.length > i && styles.pinDotFilled]}
                />
              ))}
            </View>
          </View>

          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm PIN</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPin}
                  onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
              <View style={styles.pinDots}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.pinDot,
                      confirmPin.length > i && styles.pinDotFilled,
                      confirmPin.length > i && confirmPin[i] === pin[i] && styles.pinDotMatch
                    ]}
                  />
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitBtn, 
              loading && styles.submitBtnDisabled,
              mode === 'register' && selectedRole === 'child' && styles.submitBtnChild
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons
                  name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
                  size={22}
                  color={colors.white}
                />
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Switch mode */}
        <View style={styles.switchContainer}>
          <Text style={styles.switchText}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <TouchableOpacity onPress={switchMode}>
            <Text style={styles.switchLink}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
  },
  title: {
    ...typography.h1,
    marginTop: spacing.md,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    color: colors.text,
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pinDotMatch: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  // Role selector styles
  roleSelector: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  roleOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleOptionActiveChild: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  roleOptionText: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.xs,
    color: colors.text,
  },
  roleOptionTextActive: {
    color: colors.white,
  },
  roleOptionDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  roleOptionDescActive: {
    color: colors.white,
    opacity: 0.8,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  submitBtnChild: {
    backgroundColor: colors.secondary,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  switchText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  switchLink: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  // Username validation styles
  inputValid: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  inputInvalid: {
    borderColor: colors.danger,
    borderWidth: 2,
  },
  usernameStatus: {
    paddingRight: spacing.md,
  },
  usernameHint: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  usernameHintSuccess: {
    color: colors.success,
  },
  usernameHintError: {
    color: colors.danger,
  },
});

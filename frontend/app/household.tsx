import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, borderRadius, typography } from '../src/components/theme';
import { useAuthStore } from '../src/store/authStore';

export default function HouseholdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { 
    user, 
    household, 
    createHousehold, 
    joinHousehold, 
    leaveHousehold, 
    fetchHousehold,
    loading, 
    error, 
    clearError 
  } = useAuthStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    fetchHousehold();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }
    const success = await createHousehold(householdName.trim());
    if (success) {
      setShowCreateModal(false);
      setHouseholdName('');
    }
  };

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }
    const success = await joinHousehold(inviteCode.trim().toUpperCase());
    if (success) {
      setShowJoinModal(false);
      setInviteCode('');
    }
  };

  const handleLeaveHousehold = () => {
    Alert.alert(
      'Leave Household',
      'Are you sure you want to leave this household? You will lose access to shared data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveHousehold },
      ]
    );
  };

  const handleCopyCode = async () => {
    if (household?.invite_code) {
      await Clipboard.setStringAsync(household.invite_code);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const handleShareInvite = async () => {
    if (household?.invite_code) {
      try {
        await Share.share({
          message: `Join my Kitchen Counter household!\n\nInvite Code: ${household.invite_code}\n\nOr use this link: kitchencounter://join/${household.invite_code}`,
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Household</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        {/* User Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
            <View style={styles.userInfo}>
              <Text style={styles.username}>{user?.username}</Text>
              <Text style={styles.userSubtext}>
                Member since {user?.created_at ? formatDate(user.created_at) : ''}
              </Text>
            </View>
          </View>
        </View>

        {household ? (
          <>
            {/* Household Info */}
            <View style={styles.card}>
              <View style={styles.householdHeader}>
                <Ionicons name="home" size={28} color={colors.primary} />
                <Text style={styles.householdName}>{household.name}</Text>
              </View>
              
              <View style={styles.inviteSection}>
                <Text style={styles.inviteLabel}>Invite Code</Text>
                <View style={styles.inviteCodeContainer}>
                  <Text style={styles.inviteCode}>{household.invite_code}</Text>
                  <View style={styles.inviteActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleCopyCode}>
                      <Ionicons name="copy-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleShareInvite}>
                      <Ionicons name="share-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.inviteHint}>
                  Share this code with others to invite them to your household
                </Text>
              </View>
            </View>

            {/* Members */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                Members ({household.members.length})
              </Text>
              {household.members.map((member, index) => (
                <View key={member.user_id} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <Ionicons 
                      name={member.is_owner ? 'star' : 'person-outline'} 
                      size={20} 
                      color={member.is_owner ? colors.warning : colors.textMuted} 
                    />
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>
                        {member.username}
                        {member.user_id === user?.id && ' (You)'}
                      </Text>
                      <Text style={styles.memberJoined}>
                        Joined {formatDate(member.joined_at)}
                      </Text>
                    </View>
                  </View>
                  {member.is_owner && (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerBadgeText}>Owner</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Leave Household */}
            <TouchableOpacity 
              style={styles.leaveBtn}
              onPress={handleLeaveHousehold}
            >
              <Ionicons name="exit-outline" size={20} color={colors.danger} />
              <Text style={styles.leaveBtnText}>Leave Household</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* No Household */}
            <View style={styles.card}>
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={60} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Household</Text>
                <Text style={styles.emptyText}>
                  Create a household or join an existing one to share your kitchen data with family members.
                </Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.createBtn]}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.white} />
                <Text style={styles.actionBtnText}>Create Household</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.joinBtn]}
                onPress={() => setShowJoinModal(true)}
              >
                <Ionicons name="enter-outline" size={24} color={colors.primary} />
                <Text style={[styles.actionBtnText, styles.joinBtnText]}>
                  Join with Code
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Create Household Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowCreateModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Create Household</Text>
            <Text style={styles.modalSubtitle}>
              Give your household a name (e.g., "Smith Family Kitchen")
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Household name"
              placeholderTextColor={colors.textMuted}
              value={householdName}
              onChangeText={setHouseholdName}
              autoCapitalize="words"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, loading && styles.btnDisabled]}
                onPress={handleCreateHousehold}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Join Household Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowJoinModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Join Household</Text>
            <Text style={styles.modalSubtitle}>
              Enter the invite code shared with you
            </Text>
            
            <TextInput
              style={[styles.modalInput, styles.codeInput]}
              placeholder="Enter code"
              placeholderTextColor={colors.textMuted}
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowJoinModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, loading && styles.btnDisabled]}
                onPress={handleJoinHousehold}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
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
  cardHeader: {
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
    marginTop: 2,
  },
  householdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  householdName: {
    ...typography.h2,
    marginLeft: spacing.md,
    flex: 1,
  },
  inviteSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  inviteLabel: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCode: {
    ...typography.h1,
    color: colors.primary,
    letterSpacing: 4,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    padding: spacing.sm,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md,
  },
  inviteHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberText: {
    marginLeft: spacing.md,
  },
  memberName: {
    ...typography.body,
    fontWeight: '500',
  },
  memberJoined: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ownerBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  ownerBadgeText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.danger + '10',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  leaveBtnText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actionButtons: {
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  createBtn: {
    backgroundColor: colors.primary,
  },
  joinBtn: {
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  actionBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  joinBtnText: {
    color: colors.primary,
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
    marginBottom: spacing.lg,
  },
  modalInput: {
    ...typography.body,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: 20,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  modalConfirmText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.7,
  },
});

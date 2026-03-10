import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { colors } from '@/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface CoachInvitation {
  id: string;
  coachId: string;
  patientEmail: string;
  status: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  coach: {
    id: string;
    name: string;
    email: string;
  };
}

export function CoachInvitationBanner() {
  const { user, isGuest } = useAuthStore();
  const [invitations, setInvitations] = useState<CoachInvitation[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadInvitations = useCallback(async () => {
    if (!user || isGuest) return;
    try {
      const res = await api.get<CoachInvitation[]>('/api/coach/pending-invitations');
      if (res.success && res.data && res.data.length > 0) {
        setInvitations(res.data);
      } else {
        setInvitations([]);
      }
    } catch {
      // Silently fail
    }
  }, [user, isGuest]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleRespond = async (token: string, action: 'accept' | 'decline') => {
    setLoading(true);
    try {
      await api.post(`/api/coach/invitations/${token}/${action}`, {});
      setInvitations((prev) => prev.filter((inv) => inv.token !== token));
      if (invitations.length <= 1) {
        setModalVisible(false);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  if (invitations.length === 0) return null;

  const firstInvite = invitations[0];

  return (
    <>
      <Pressable onPress={() => setModalVisible(true)} style={styles.banner}>
        <Text style={styles.bannerText}>
          {invitations.length === 1
            ? `${firstInvite.coach.name} te invita como paciente`
            : `Tienes ${invitations.length} invitaciones de coach pendientes`}
        </Text>
        <Text style={styles.bannerAction}>Ver</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invitaciones de Coach</Text>

            {invitations.map((inv) => (
              <View key={inv.id} style={styles.invitationCard}>
                <View style={styles.coachInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {inv.coach.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.coachDetails}>
                    <Text style={styles.coachName}>{inv.coach.name}</Text>
                    <Text style={styles.coachEmail}>{inv.coach.email}</Text>
                  </View>
                </View>

                <Text style={styles.inviteDescription}>
                  Te invita a ser su paciente. Al aceptar, podrá ver tu historial de
                  calorías, peso y conversaciones con Nova.
                </Text>

                <View style={styles.buttonRow}>
                  <Pressable
                    onPress={() => handleRespond(inv.token, 'decline')}
                    style={[styles.button, styles.declineButton]}
                    disabled={loading}
                  >
                    <Text style={styles.declineText}>Rechazar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRespond(inv.token, 'accept')}
                    style={[styles.button, styles.acceptButton]}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptText}>Aceptar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerText: {
    color: colors.text.secondary,
    fontSize: 13,
    flex: 1,
  },
  bannerAction: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.gradient.from,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  invitationCard: {
    backgroundColor: colors.glass.bg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  coachInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(147, 51, 234, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.primaryLight,
    fontSize: 18,
    fontWeight: '700',
  },
  coachDetails: {
    marginLeft: 12,
    flex: 1,
  },
  coachName: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  coachEmail: {
    color: colors.text.muted,
    fontSize: 13,
    marginTop: 2,
  },
  inviteDescription: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  acceptButton: {
    backgroundColor: colors.primary,
  },
  declineText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  acceptText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  closeText: {
    color: colors.text.muted,
    fontSize: 14,
  },
});

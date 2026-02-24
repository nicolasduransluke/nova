import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/auth.store';
import { GradientBackground } from '@/components/common/GradientBackground';
import { GlassCard } from '@/components/common/GlassCard';
import { TextInput } from '@/components/common/TextInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors } from '@/theme';
import * as AppleAuthentication from 'expo-apple-authentication';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { login, loginWithGoogle, loginWithApple, enterGuestMode, isLoading, error, setError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Por favor completa todos los campos');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch {
      // Error is set in the store
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>NOVA</Text>
            <Text style={styles.subtitle}>Coach de Déficit Calórico</Text>
          </View>

          <GlassCard>
            <Text style={styles.title}>Iniciar Sesión</Text>

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TextInput
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError(null);
              }}
              keyboardType="email-address"
              autoComplete="email"
            />

            <TextInput
              label="Contraseña"
              placeholder="Tu contraseña"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError(null);
              }}
              secureTextEntry
              autoComplete="password"
            />

            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotLink}
            >
              <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>

            <PrimaryButton
              title="Iniciar Sesión"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!email.trim() || !password.trim()}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.googleButton}
              onPress={loginWithGoogle}
              disabled={isLoading}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>Continuar con Google</Text>
            </Pressable>

            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={loginWithApple}
              />
            )}

            <Pressable onPress={enterGuestMode} style={styles.guestLink}>
              <Text style={styles.guestText}>Probar sin cuenta</Text>
            </Pressable>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>¿No tienes cuenta? </Text>
              <Pressable onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Crear cuenta</Text>
              </Pressable>
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -8,
  },
  linkText: {
    color: colors.text.muted,
    fontSize: 13,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.glass.border,
  },
  dividerText: {
    color: colors.text.muted,
    marginHorizontal: 12,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: 10,
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: 16,
  },
  guestLink: {
    alignItems: 'center',
    marginBottom: 20,
  },
  guestText: {
    color: colors.text.muted,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  registerLink: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: '600',
  },
});

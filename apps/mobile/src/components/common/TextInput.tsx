import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  Pressable,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import { colors } from '@/theme';

interface Props extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
}

export function TextInput({ label, error, secureTextEntry, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, focused && styles.focused, error && styles.errorBorder]}>
        <RNTextInput
          style={styles.input}
          placeholderTextColor={colors.text.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry && !showPassword}
          autoCapitalize="none"
          {...props}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass.bgLight,
    borderWidth: 1,
    borderColor: colors.glass.border,
    borderRadius: 12,
  },
  focused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  eyeText: {
    fontSize: 18,
  },
  error: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
});

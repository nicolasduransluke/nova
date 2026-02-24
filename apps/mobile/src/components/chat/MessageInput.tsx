import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  Image,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';

interface Props {
  onSend: (content: string, imageUrl?: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: Props) {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const canSend = (text.trim().length > 0 || imagePreview) && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(text.trim(), imagePreview || undefined);
    setText('');
    setImagePreview(null);
  };

  const processResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        setImagePreview(`data:image/jpeg;base64,${asset.base64}`);
      } else if (asset.uri) {
        setImagePreview(asset.uri);
      }
    }
  };

  const handlePickImage = () => {
    Alert.alert('Agregar foto', undefined, [
      {
        text: 'Tomar foto',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permiso necesario', 'Se necesita acceso a la cámara para tomar fotos.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
          });
          processResult(result);
        },
      },
      {
        text: 'Elegir de galería',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
          });
          processResult(result);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      {imagePreview && (
        <View style={styles.previewRow}>
          <Image source={{ uri: imagePreview }} style={styles.previewImage} />
          <Pressable
            onPress={() => setImagePreview(null)}
            style={styles.removeButton}
          >
            <Text style={styles.removeText}>{'✕'}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        <Pressable
          onPress={handlePickImage}
          disabled={disabled}
          style={[styles.iconButton, disabled && styles.iconDisabled]}
        >
          <Text style={styles.cameraIcon}>{'📷'}</Text>
        </Pressable>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colors.text.placeholder}
          multiline
          maxLength={2000}
          editable={!disabled}
        />

        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[styles.sendButton, !canSend && styles.sendDisabled]}
        >
          <Text style={styles.sendIcon}>{'➤'}</Text>
        </Pressable>
      </View>

      {text.length > 1600 && (
        <Text style={styles.charCount}>{text.length}/2000</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.gradient.from,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  previewRow: {
    marginBottom: 8,
    position: 'relative',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    left: 68,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconDisabled: {
    opacity: 0.4,
  },
  cameraIcon: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 18,
  },
  charCount: {
    fontSize: 11,
    color: colors.text.dimmed,
    textAlign: 'right',
    marginTop: 4,
  },
});

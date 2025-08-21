import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Avatar, Button, Text, YStack } from 'tamagui';
import * as ImagePicker from 'expo-image-picker';
import { imageToBase64 } from '../../firebase/services_firestore2';

interface PhotoAvatarProps {
  size?: any;
  photoUrl?: string;
  name?: string;
  onPhotoChange?: (photoUrl: string) => void;
  editable?: boolean;
  borderColor?: any;
  borderWidth?: number;
  backgroundColor?: any;
  textColor?: any;
  fontSize?: any;
}

export const PhotoAvatar: React.FC<PhotoAvatarProps> = ({
  size = "$8",
  photoUrl,
  name = "",
  onPhotoChange,
  editable = false,
  borderColor = "$color9",
  borderWidth = 2,
  backgroundColor = "$color9",
  textColor = "$color1",
  fontSize = "$4"
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Function to generate initials
  const generateInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Function to pick image
  const pickImage = async () => {
    if (!editable) return;
    
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to select a photo.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedPhoto(result.assets[0].uri);
        
        // Convert to Base64 and notify parent
        if (onPhotoChange) {
          setUploadingPhoto(true);
          try {
            const base64Photo = await imageToBase64(result.assets[0].uri);
            onPhotoChange(base64Photo);
          } catch (error) {
            console.error('Error converting image:', error);
            Alert.alert('Error', 'Failed to process image. Please try again.');
          } finally {
            setUploadingPhoto(false);
          }
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Determine what to display
  const getDisplayContent = () => {
    // Priority: selectedPhoto > photoUrl > initials
    const currentPhoto = selectedPhoto || photoUrl;
    
    if (currentPhoto && currentPhoto.startsWith('data:')) {
      // Base64 image
      return <Avatar.Image src={currentPhoto} />;
    } else if (currentPhoto && currentPhoto.startsWith('INITIALS:')) {
      // Stored initials
      return (
        <Avatar.Fallback backgroundColor={backgroundColor} justifyContent="center" alignItems="center">
          <Text color={textColor} fontSize={fontSize} fontWeight="bold" style={{ textAlign: 'center' }}>
            {currentPhoto.replace('INITIALS:', '')}
          </Text>
        </Avatar.Fallback>
      );
    } else {
      // Generate initials from name
      const initials = generateInitials(name);
      return (
        <Avatar.Fallback backgroundColor={backgroundColor} justifyContent="center" alignItems="center">
          <Text color={textColor} fontSize={fontSize} fontWeight="bold" style={{ textAlign: 'center' }}>
            {initials}
          </Text>
        </Avatar.Fallback>
      );
    }
  };

  return (
    <YStack style={{ alignItems: 'center' }} space="$2">
      <Button
        onPress={pickImage}
        bg="transparent"
        borderWidth={0}
        p={0}
        disabled={!editable || uploadingPhoto}
      >
        <Avatar
          circular
          size={size}
          borderWidth={borderWidth}
          borderColor={borderColor}
          borderStyle={editable && !selectedPhoto && !photoUrl ? "dashed" : "solid"}
          background="transparent"
        >
          {getDisplayContent()}
        </Avatar>
      </Button>
      
      {editable && (
        <Text color="$color10" fontSize="$3" style={{ textAlign: 'center' }}>
          {uploadingPhoto ? 'Processing...' : 
           selectedPhoto || photoUrl ? 'Photo selected' : 
           name ? `Will show: ${generateInitials(name)}` : 'Add Photo'}
        </Text>
      )}
    </YStack>
  );
}; 
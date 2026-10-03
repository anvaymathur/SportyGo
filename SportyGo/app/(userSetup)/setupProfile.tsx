import { Alert, Platform, Keyboard, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback } from "react-native";
import React, { useContext, useEffect, useRef, useState } from "react";
import { Button, Input, YStack, Text, H2, Paragraph } from 'tamagui'
import { router } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { createUserProfile, checkForClaimableTemps } from '../../firebase/services_firestore2';
import { openPrivacyPolicy } from "@/utils/support";
import { UserContext } from "@/components/userContext";
import { SafeAreaWrapper } from "@/components/SafeAreaWrapper";
import { PhotoAvatar } from "@/components/PhotoAvatar";
import DateTimePicker from '@react-native-community/datetimepicker'


// Helper functions to calculate age from a Date or YYYY-MM-DD string
const calculateAgeFromDate = (date: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const hasNotHadBirthdayThisYear = (
        today.getMonth() < date.getMonth() ||
        (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
    );
    if (hasNotHadBirthdayThisYear) age -= 1;
    return age;
};

const calculateAgeFromYmd = (ymd: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const parsed = new Date(ymd + 'T00:00:00');
    if (isNaN(parsed.getTime())) return null;
    return calculateAgeFromDate(parsed);
};

export default function SetupProfile() {
    const {user} = useAuth0()
    const { saveUser } = useContext(UserContext);

    const [name, setName] = useState('')
    const [isPhotoProcessing, setIsPhotoProcessing] = useState(false)
    const creatingRef = useRef(false)
    const [creating, setCreating] = useState(false)
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [photoUrl, setPhotoUrl] = useState<string>('')
    const [dob, setDob] = useState('')
    const [showDobPicker, setShowDobPicker] = useState(false)

    const handleDismissOverlays = () => {
        Keyboard.dismiss()
        setShowDobPicker(false)
    }

    useEffect(() => {
        if (user && user.email){
            setEmail(user.email.trim().toLowerCase())
        }
        if (user && user.name && user.name !== user.email) {
            setName(user.name)
        }

        if (user && user.phoneNumber){
            // Auth0 can return formatted / +1 numbers; keep the last 10 digits like the input does
            setPhone(user.phoneNumber.replace(/\D/g, '').slice(-10))
        }
    }, [user]) 

   const createProfile = async () => {
        // Age restriction: disallow users under 13
        const age = calculateAgeFromYmd(dob);
        if (age !== null && age < 13) {
            Alert.alert(
                "Age Restriction",
                "We cannot allow users under 13 on the app.",
                [{ text: "OK" }]
            );
            return;
        }

        const trimmedName = name.trim()
        const normalizedEmail = email.trim().toLowerCase()
        // Phone is optional (App Store 5.1.1: only require what the app needs), but must be complete if given
        if (phone.length > 0 && phone.length !== 10) {
            Alert.alert("Invalid Phone", "Phone number must be exactly 10 digits, or left blank.", [{ text: "OK" }])
            return
        }

        if (user && trimmedName && normalizedEmail && user.sub && dob){
            if (creatingRef.current) return
            creatingRef.current = true
            setCreating(true)
            try {
                const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(dob + 'T00:00:00') : undefined

                const userProfile = {
                    id: user.sub, 
                    Name: trimmedName,
                    Email: normalizedEmail,
                    Groups: [], 
                    Phone: phone,
                    Address: '',
                    PhotoUrl: photoUrl || "",
                    DateOfBirth: dateOfBirth || undefined
                }
                await createUserProfile(user.sub,userProfile)
                try {
                    delete (user as any)["https://badmintonapp.com/is_signup"]
                } catch {}
                await saveUser({name: trimmedName, email: normalizedEmail})
                // Detect claimable temp users before routing to dashboard
                const claimable = await checkForClaimableTemps(normalizedEmail, phone);
                if (claimable.length > 0) {
                    router.replace({ pathname: '/claimTempUsers' as any, params: { ids: JSON.stringify(claimable.map(t => t.id)) } });
                } else {
                    router.replace('/dashboard')
                }
            } catch (error) {
                console.error('Error creating profile:', error)
                Alert.alert("Error", "Failed to create your profile. Please try again.")
            } finally {
                creatingRef.current = false
                setCreating(false)
            }
        } else {
            Alert.alert(
                "Missing Information",
                "Please enter your name, email and date of birth.",
                [{ text: "OK" }]
              )
        }
   }

    const onChangeDob = (_event: any, selectedDate?: Date) => {
        if (Platform.OS !== 'ios') setShowDobPicker(false)
        if (selectedDate) {
            const year = selectedDate.getFullYear()
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
            const day = String(selectedDate.getDate()).padStart(2, '0')
            setDob(`${year}-${month}-${day}`)
        }
    }

    return (
        <SafeAreaWrapper backgroundColor="$background">
            <TouchableWithoutFeedback onPress={handleDismissOverlays} accessible={false}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : undefined}
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 32 }}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        onStartShouldSetResponderCapture={() => {
                            if (showDobPicker) {
                                setShowDobPicker(false)
                            }
                            return false
                        }}
                    >
                        <YStack gap="$6" items="center" flex={1}>
                            <YStack gap="$5" style={{ alignItems: 'center', paddingTop: 8 }}>
                                <H2 color="$color9" fontWeight="bold" mb="$8">
                                    Create Profile
                                </H2>
                                <PhotoAvatar
                                    size="$11"
                                    photoUrl={photoUrl}
                                    name={name}
                                    onPhotoChange={setPhotoUrl}
                                    onProcessingChange={setIsPhotoProcessing}
                                    editable={true}
                                    borderColor="$color9"
                                    borderWidth={0}
                                    backgroundColor="$color9"
                                    textColor="$color1"
                                    fontSize="$6"
                                    
                                    
                                />
                            </YStack>

                            <YStack gap="$4" width="100%" style={{ maxWidth: 320, alignSelf: 'center' }}>
                                <Input
                                    value={name}
                                    onChangeText={(text: any) => setName(text)}
                                    onFocus={() => setShowDobPicker(false)}
                                    placeholder="Name"
                                    borderColor="$color6"
                                    borderWidth={1}
                                    focusStyle={{
                                        borderWidth: 2,
                                        borderColor: '$color6'
                                    }}
                                    background="$color2"
                                    placeholderTextColor="$color10"
                                    color="$color"
                                    p="$2"
                                    pl="$3"
                                    style={{ borderRadius: 8, fontSize: 16 }}
                                />

                                <Input
                                    value={email}
                                    onChangeText={(text: any) => setEmail(text)}
                                    editable={!user?.email}
                                    opacity={user?.email ? 0.7 : 1}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    onFocus={() => setShowDobPicker(false)}
                                    placeholder="Email"
                                    borderColor="$color6"
                                    borderWidth={1}
                                    focusStyle={{
                                        borderWidth: 2,
                                        borderColor: '$color6'
                                    }}
                                    background="$color2"
                                    placeholderTextColor="$color10"
                                    color="$color"
                                    p="$2"
                                    pl="$3"
                                    style={{ borderRadius: 8, fontSize: 16 }}
                                />

                                <Button
                    onPress={() => {
                        Keyboard.dismiss()
                        setShowDobPicker((prev) => !prev)
                    }}
                                    unstyled
                                    borderColor="$color6"
                                    borderWidth={1}
                                    bg="$color2"
                                    p="$3"
                                    style={{ borderRadius: 8 }}
                                >
                                    <Text color="$color" fontSize="$4">
                                        {dob ? dob : 'Date of Birth (YYYY-MM-DD)'}
                                    </Text>
                                </Button>
                                {showDobPicker && (
                                    <DateTimePicker
                                        value={/^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(dob + 'T00:00:00') : new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                                        textColor="black"
                                        maximumDate={new Date()}
                                        onChange={onChangeDob}
                                    />
                                )}
                                
                                <Input
                                    keyboardType="numeric"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={phone}
                                    onChangeText={(text: any) => {
                                        const onlyDigits = text.replace(/\D/g, '')
                                        setPhone(onlyDigits)
                                    }}
                                    onFocus={() => setShowDobPicker(false)}
                                    placeholder="Phone (optional)"
                                    borderColor="$color6"
                                    borderWidth={1}
                                    focusStyle={{
                                        borderWidth: 2,
                                        borderColor: '$color6'
                                    }}
                                    background="$color2"
                                    placeholderTextColor="$color10"
                                    color="$color"
                                    p="$2"
                                    pl="$3"
                                    style={{ borderRadius: 8, fontSize: 16 }}
                                />
                            </YStack>

                            <Button
                                fontSize="$7"
                                width="95%"
                                bg="$color9"
                                color="$color1"
                                onPress={createProfile}
                                disabled={creating || isPhotoProcessing}
                            >
                                {creating ? 'Creating Profile...' : isPhotoProcessing ? 'Processing photo...' : 'Create Profile'}
                            </Button>

                            <Paragraph color="$color10" fontSize="$2" style={{ textAlign: 'center', maxWidth: 320, alignSelf: 'center' }}>
                                By creating a profile you agree to how we handle your data in our{' '}
                                <Paragraph color="$color9" fontSize="$2" textDecorationLine="underline" onPress={openPrivacyPolicy}>
                                    Privacy Policy
                                </Paragraph>
                                .
                            </Paragraph>
                        </YStack>
                    </ScrollView>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaWrapper>
    )
}
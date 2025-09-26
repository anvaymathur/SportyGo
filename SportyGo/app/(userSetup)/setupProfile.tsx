import { Alert, Platform} from "react-native";
import React, { useContext, useEffect, useState } from "react";
import { Button, Input, YStack, XStack, Text, H2, View } from 'tamagui'
import { router } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { PhoneInput } from "../components/phoneInput";
import { UserDoc } from '../../firebase/types_index';
import { createUserProfile, getUserProfile, updateUserProfile } from '../../firebase/services_firestore2';
import { UserContext } from "../components/userContext";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";
import { PhotoAvatar } from "../components/PhotoAvatar";
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
    const {globalUser, saveUser } = useContext(UserContext);

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [photoUrl, setPhotoUrl] = useState<string>('')
    const [dob, setDob] = useState('')
    const [showDobPicker, setShowDobPicker] = useState(false)

    useEffect(() => {
        if (user && user.email){
            setEmail(user.email)
        }
        if (user && user.name && user.name !== user.email) {
            setName(user.name)
        }

        if (user && user.phoneNumber){
            setPhone(user.phoneNumber)
        }
        // if (user && user.address){
        //     setAddress(user.address)
        // }
    }, [user]) 

   const createProfile = async () => {
        console.log('createProfile')
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

        if (user && name && email && phone.length == 10 && user.sub && dob){
            
            const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(dob + 'T00:00:00') : undefined

            const userProfile = {
                id: user.sub, 
                Name: name,
                Email: email,
                Groups: [], 
                Phone: phone,
                Address: '', //address.trim(),
                PhotoUrl: photoUrl || "",
                DateOfBirth: dateOfBirth || undefined
            }
            console.log('creating userProfile')
            await createUserProfile(user.sub,userProfile)
            console.log('userProfile created')
            try {
                delete (user as any)["https://badmintonapp.com/is_signup"]
            } catch {}
            await saveUser({name: name, email: email})
            router.replace('/dashboard')
        } else {
            Alert.alert(
                "Missing Information",
                "Please fill all the required information.",
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

            // Immediate age check and warning
            const age = calculateAgeFromDate(selectedDate)
            if (age < 13) {
                Alert.alert(
                    "Age Restriction",
                    "We cannot allow users under 13 on the app.",
                    [{ text: "OK" }]
                )
            }
        }
    }

    return (
        <SafeAreaWrapper backgroundColor="$background">
            <YStack flex={1} p="$4" space="$6" style={{ justifyContent: 'center', alignItems: 'center' }}>
                {/* Title */}
                {/* <Text 
                    fontSize="$9" 
                    fontWeight="bold" 
                    color="$color9"
                    mb="$4"
                    style={{ textTransform: 'uppercase' }}
                >
                    Create Profile
                </Text> */}
                <H2 color="$color9" fontWeight="bold"> Create Profile</H2>

                {/* Profile Photo */}
                <PhotoAvatar
                    size="$12"
                    photoUrl={photoUrl}
                    name={name}
                    onPhotoChange={setPhotoUrl}
                    editable={true}
                    borderColor="$color9"
                    borderWidth={2}
                    backgroundColor="$color9"
                    textColor="$color1"
                    fontSize="$6"
                />

                {/* Input Fields */}
                <YStack space="$4" width="100%" style={{ maxWidth: 300 }}>
                    <Input
                        value={name}
                        onChangeText={setName}
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
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    />
                    
                    <Input
                        value={email}
                        onChangeText={setEmail}
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
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    />
                    
                    {/* Date of Birth Picker */}
                    <Button
                        onPress={() => setShowDobPicker(true)}
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
                    
                    {/* <PhoneInput/> */}
                    <Input
                        keyboardType="numeric"
                        inputMode="numeric"
                        maxLength={10}
                        value={phone}
                        onChangeText={(text) => {
                            const onlyDigits = text.replace(/\D/g, '')
                            setPhone(onlyDigits)
                        }}
                        placeholder="Phone"
                        borderColor="$color6"
                        borderWidth={1}
                        focusStyle={{
                            borderWidth: 2,
                            borderColor: '$color6'
                        }}
                        background="$color2"
                        placeholderTextColor="$color10"
                        color="$color"
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    />
                    
                    {/* <Input
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Address"
                        autoCapitalize="words"
                        autoComplete="street-address"
                        textContentType="fullStreetAddress"
                        autoCorrect={false}
                        returnKeyType="done"
                        inputMode="text"
                        clearButtonMode="while-editing"
                        borderColor="$color6"
                        borderWidth={1}
                        focusStyle={{
                            borderWidth: 2,
                            borderColor: '$color6'
                        }}
                        background="$color2"
                        placeholderTextColor="$color10"
                        color="$color"
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    /> */}
                
                </YStack>
                {/* Create Profile Button */}
                <Button
                    fontSize="$7"  
                    width="95%"
                    bg="$color9"
                    color="$color1"  
                    onPress={createProfile}
                >
                    Create Profile
                </Button>
            </YStack>
        </SafeAreaWrapper>
    )
}
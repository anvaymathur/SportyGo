import { Alert} from "react-native";
import React, { useContext, useEffect, useState } from "react";
import { Button, Input, YStack, XStack, Text, Avatar, H2, View } from 'tamagui'
import { router } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { PhoneInput } from "../components/phoneInput";
import { UserDoc } from '../../firebase/types_index';
import { createUserProfile, getUserProfile, updateUserProfile } from '../../firebase/services_firestore2';
import { UserContext } from "../components/userContext";



export default function SetupProfile() {
    const {user} = useAuth0()
    const {globalUser, saveUser } = useContext(UserContext);

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')

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
        if (user && name && email && phone.length == 10 && user.sub){
            
            const userProfile = {
                id: user.sub, 
                Name: name,
                Email: email,
                Groups: [], 
                Phone: phone,
                Address: ''
            }
            await createUserProfile(user.sub,userProfile)
            await saveUser({name: name, email: email})
            router.replace('/matchHistory/dashboard')
        } else {
            Alert.alert(
                "Missing Information",
                "Please fill all the required information.",
                [{ text: "OK" }]
              )
        }
   }

    return (
        <View flex={1} bg="$background">
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

                {/* Profile Icon */}
                <Avatar 
                    circular
                    size="$12" 
                    borderWidth={2} 
                    borderColor="$color9"
                    backgroundColor="$color2"
                    mb="$6"
                >
                    <Avatar.Image src={require('../../assets/images/defaultUserProfileImage.png')} />
                    <Avatar.Fallback backgroundColor="$color2">
                        <Text fontSize="$8" color="$color9">👤</Text>
                    </Avatar.Fallback>
                </Avatar>

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
                        placeholder="Address (optional)"
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
                        style={{ borderRadius: 2 }}
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
        </View>
    )
}
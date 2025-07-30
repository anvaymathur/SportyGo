import { View } from "react-native";
import React, { useEffect, useState } from "react";
import { Button, Input, YStack, XStack, Text, Avatar, H1, H2 } from 'tamagui'
import { router } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { PhoneInput } from "../components/phoneInput";

export default function SetupProfile() {
    const {user} = useAuth0()
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
        if (user && user.address){
            setAddress(user.address)
        }
    }, [user]) 

   function createProfile(): void{

        if (name && email && phone.length == 10){
            // router.replace('/tabs/profile')
            console.log('Required Information is there')
        } else{
            console.log('Required information is not there')
        }
   }

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <YStack flex={1} p="$4" space="$6" style={{ justifyContent: 'center', alignItems: 'center' }}>
                {/* Title */}
                {/* <Text 
                    fontSize="$9" 
                    fontWeight="bold" 
                    color="$green10"
                    mb="$4"
                    style={{ textTransform: 'uppercase' }}
                >
                    Create Profile
                </Text> */}
                <H2 color="$green10" fontWeight="bold"> Create Profile</H2>

                {/* Profile Icon */}
                <Avatar 
                    circular
                    size="$12" 
                    borderWidth={2} 
                    borderColor="$green10"
                    backgroundColor="$green2"
                    mb="$6"
                >
                    <Avatar.Image src={require('../../assets/images/defaultUserProfileImage.png')} />
                    <Avatar.Fallback backgroundColor="$green2">
                        <Text fontSize="$8" color="$green10">👤</Text>
                    </Avatar.Fallback>
                </Avatar>

                {/* Input Fields */}
                <YStack space="$4" width="100%" style={{ maxWidth: 300 }}>
                    <Input
                        value={name}
                        onChangeText={setName}
                        placeholder="Name"
                        borderColor="$green10"
                        borderWidth={1}
                        focusStyle={{
                            borderWidth: 2,
                            borderColor: '$green10'
                        }}
                        background="$green1"
                        placeholderTextColor="$green10"
                        color="$green10"
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    />
                    
                    <Input
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        borderColor="$green10"
                        borderWidth={1}
                        focusStyle={{
                            borderWidth: 2,
                            borderColor: '$green10'
                        }}
                        background="$green1"
                        placeholderTextColor="$green10"
                        color="$green10"
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
                        borderColor="$green10"
                        borderWidth={1}
                        focusStyle={{
                            borderWidth: 2,
                            borderColor: '$green10'
                        }}
                        background="$green1"
                        placeholderTextColor="$green10"
                        color="$green10"
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    />
                    
                    <Input
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Address (optional)"
                        borderColor="$green10"
                        borderWidth={1}
                        focusStyle={{
                            borderWidth: 2,
                            borderColor: '$green10'
                        }}
                        background="$green1"
                        placeholderTextColor="$green10"
                        color="$green10"
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 2 }}
                    />
                
                </YStack>
                {/* Create Profile Button */}
                <Button
                    fontSize="$7"  
                    width="95%"
                    bg="$green10"
                    color="white"  
                    onPress={createProfile}
                >
                    Create Profile
                </Button>
                
            </YStack>
        </View>
    )
}
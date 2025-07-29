import { View } from "react-native";
import React from "react";
import { Button, Input, YStack, XStack, Text, Avatar, H1, H2 } from 'tamagui'
import { router } from "expo-router";

export default function SetupProfile() {
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
                        placeholder="Name"
                        borderColor="$green10"
                        borderWidth={2}
                        background="$green1"
                        placeholderTextColor="$green10"
                        color="$green10"
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    />
                    
                    <Input
                        placeholder="Email"
                        borderColor="$green10"
                        borderWidth={2}
                        background="$green1"
                        placeholderTextColor="$green10"
                        color="$green10"
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    />
                    
                    <Input
                        placeholder="Phone"
                        borderColor="$green10"
                        borderWidth={2}
                        background="$green1"
                        placeholderTextColor="$green10"
                        color="$green10"
                        fontSize="$4"
                        p="$3"
                        style={{ borderRadius: 8 }}
                    />
                    
                    <Input
                        placeholder="Address"
                        borderColor="$green10"
                        borderWidth={2}
                        background="$green1"
                        placeholderTextColor="$green10"
                        color="$green10"
                        fontSize="$5"
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
                    onPress={() => router.replace('/tabs/profile')}
                >
                    Create Profile
                </Button>
                
            </YStack>
        </View>
    )
}
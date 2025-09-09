import React, { useState } from 'react'
import { Input } from 'tamagui'
import { AsYouType } from 'libphonenumber-js'

type PhoneInputProps = {
  onChange?: (formatted: string, raw: string) => void
}

export function PhoneInput({ onChange }: PhoneInputProps) {
  const [rawDigits, setRawDigits] = useState('')

  const handleChange = (text: string) => {
    const onlyDigits = text.replace(/\D/g, '')
    setRawDigits(onlyDigits)

    const formatted = new AsYouType('US').input(onlyDigits)
    onChange?.(formatted, onlyDigits)
  }

  const formattedValue = new AsYouType('US').input(rawDigits)

  return (
    <Input
      keyboardType="numeric"
      inputMode="numeric"
      maxLength={14}
      value={formattedValue}
      onChangeText={handleChange}
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
  )
}

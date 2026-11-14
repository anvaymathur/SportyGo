import React from 'react'
import { Input } from 'tamagui'
import { formatPhone, phoneDigits } from '@/utils/phone'

type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChangeText' | 'onChange'> & {
  /** The number as digits only, which is how it is stored */
  value: string
  onChangeDigits: (digits: string) => void
}

/**
 * Phone field that shows the number formatted as it is typed, e.g. (555) 123-4567, while the
 * caller only ever sees digits.
 */
export function PhoneInput({ value, onChangeDigits, ...inputProps }: PhoneInputProps) {
  const formatted = formatPhone(value)

  const handleChange = (text: string) => {
    let digits = phoneDigits(text)
    // Backspacing over punctuation ("(555)" -> "(555") leaves the digits unchanged, which would
    // re-format to the same text and make the field feel stuck; remove a digit instead
    if (text.length < formatted.length && digits === value) digits = digits.slice(0, -1)
    onChangeDigits(digits)
  }

  return (
    <Input
      keyboardType="phone-pad"
      inputMode="tel"
      autoComplete="tel"
      textContentType="telephoneNumber"
      maxLength={14}
      placeholder="Phone"
      borderColor="$color6"
      borderWidth={1}
      focusStyle={{ borderWidth: 2, borderColor: '$color6' }}
      background="$color2"
      placeholderTextColor="$color10"
      color="$color"
      p="$3"
      style={{ borderRadius: 8, fontSize: 16 }}
      {...inputProps}
      value={formatted}
      onChangeText={(text: any) => handleChange(String(text))}
    />
  )
}

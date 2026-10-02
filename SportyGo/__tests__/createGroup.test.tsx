import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from './test-utils';
import CreateGroup from '../app/(tabs)/groups/createGroup';

jest.mock('../firebase/services_firestore2', () => ({
  createGroup: jest.fn(),
  uploadImage: jest.fn(),
  testStorageConnection: jest.fn(),
  imageToBase64: jest.fn(),
}));

describe('CreateGroup description', () => {
  it('does not count whitespace toward the 150 character limit', () => {
    renderWithTheme(<CreateGroup />);
    const description = screen.getByPlaceholderText("What's this group about?");
    // A native maxLength would count spaces and cut typing off early (changeText doesn't enforce it)
    expect(description.props.maxLength).toBeUndefined();

    // 150 letters plus spaces/newlines: well over 150 characters in total, but allowed
    const atLimit = ('abcde \n'.repeat(30)).trimEnd();
    expect(atLimit.length).toBeGreaterThan(150);
    fireEvent.changeText(description, atLimit);
    expect(screen.getByDisplayValue(atLimit)).toBeTruthy();
    expect(screen.getByText('150/150')).toBeTruthy();

    // A 151st letter is rejected
    fireEvent.changeText(description, atLimit + 'x');
    expect(screen.getByDisplayValue(atLimit)).toBeTruthy();
  });

  it('counts only letters in the counter', () => {
    renderWithTheme(<CreateGroup />);
    fireEvent.changeText(screen.getByPlaceholderText("What's this group about?"), 'hi there\nfriends');
    expect(screen.getByText('14/150')).toBeTruthy();
  });
});

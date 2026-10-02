// Shared mocks for native modules and services the screens depend on.
// Firestore service functions are mocked per test file.

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Icons load fonts asynchronously; render a plain placeholder instead
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => React.createElement(Text, null, `icon:${name}`);
  return { Ionicons: Icon, MaterialIcons: Icon, FontAwesome: Icon, MaterialCommunityIcons: Icon };
});

// Signed-in Auth0 user; tests change `mockAuthUser.sub` to act as different people
export const mockAuthUser: { sub: string; name?: string } = { sub: 'owner-1' };
jest.mock('react-native-auth0', () => ({
  useAuth0: () => ({ user: mockAuthUser, isLoading: false, clearSession: jest.fn() }),
}));

export const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
export const mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const React = require('react');
  const Stack = ({ children }: any) => React.createElement(React.Fragment, null, children);
  Stack.Screen = () => null;
  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockSearchParams,
    usePathname: () => '/',
    useNavigation: () => ({ getParent: () => ({ setOptions: jest.fn() }) }),
    Stack,
  };
});

// Never initialize or talk to the real Firebase project in tests
jest.mock('../firebase/index', () => ({ app: {}, db: {}, storage: {} }));
export const mockFirestore = {
  doc: jest.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` })),
  updateDoc: jest.fn(async () => undefined),
  onSnapshot: jest.fn(() => () => undefined),
  arrayUnion: jest.fn((v: string) => ({ op: 'arrayUnion', v })),
  arrayRemove: jest.fn((v: string) => ({ op: 'arrayRemove', v })),
};
jest.mock('firebase/firestore', () => ({
  ...mockFirestore,
  getFirestore: jest.fn(),
  Timestamp: { now: jest.fn(), fromDate: jest.fn() },
}));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Picker = ({ children }: any) => React.createElement(View, null, children);
  Picker.Item = () => null;
  return { Picker };
});

jest.mock('@react-native-community/datetimepicker', () => () => null);

jest.mock('react-native-keyboard-aware-scroll-view', () => {
  const { ScrollView } = require('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthUser.sub = 'owner-1';
  for (const key of Object.keys(mockSearchParams)) delete mockSearchParams[key];
});

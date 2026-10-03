import { Alert, Linking } from 'react-native';
import constants from '@/app/constants';

/** Opens the privacy policy in the browser. */
export async function openPrivacyPolicy(): Promise<void> {
  try {
    await Linking.openURL(constants.PrivacyPolicyUrl);
  } catch {
    Alert.alert('Privacy Policy', `You can read it at ${constants.PrivacyPolicyUrl}`);
  }
}

/**
 * Opens the user's mail app addressed to support. If no mail app is set up, shows the
 * address instead so they can still get in touch.
 */
export async function emailSupport(subject: string, body = ''): Promise<void> {
  const url = `mailto:${constants.SupportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    // openURL rejects when nothing can handle mailto: (canOpenURL would need an Info.plist entry)
    await Linking.openURL(url);
  } catch {
    Alert.alert('Contact us', `Email us at ${constants.SupportEmail}`);
  }
}

export type ReportTarget =
  | { kind: 'group'; id: string; name: string }
  | { kind: 'user'; id: string; name: string; groupId?: string };

/**
 * Reports objectionable content or behaviour to the SportyGo team (App Store guideline 1.2).
 * Asks for confirmation, then opens a pre-filled email with the IDs needed to follow up.
 */
export function reportContent(target: ReportTarget, reporterId: string): void {
  const what = target.kind === 'group' ? `the group "${target.name}"` : target.name;
  Alert.alert(
    'Report',
    `Report ${what} for inappropriate content or behaviour? The SportyGo team will review it.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => {
          const lines = [
            'Please describe what happened:',
            '',
            '',
            '---',
            target.kind === 'group' ? `Group: ${target.name} (${target.id})` : `User: ${target.name} (${target.id})`,
            ...(target.kind === 'user' && target.groupId ? [`In group: ${target.groupId}`] : []),
            `Reported by: ${reporterId}`,
          ];
          emailSupport(`Report: ${target.kind === 'group' ? 'group' : 'user'} ${target.name}`, lines.join('\n'));
        },
      },
    ]
  );
}

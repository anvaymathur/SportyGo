// plugins/withAuth0Intent.js
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAuth0Intent(config) {
  return withAndroidManifest(config, async (configWithManifest) => {
    const manifest = configWithManifest.modResults;
    const application = manifest.manifest.application[0];

    // 1. Ensure tools namespace exists
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ||
      'http://schemas.android.com/tools';

    // 2. Remove RedirectActivity entirely
    application.activity = application.activity.map((activity) => {
      if (activity.$['android:name'] === 'com.auth0.android.provider.RedirectActivity') {
        activity.$['tools:node'] = 'remove';
      }
      return activity;
    });

    // 3. Find MainActivity
    const mainActivity = application.activity.find(
      (activity) => activity.$['android:name'].endsWith('.MainActivity')
    );
    if (!mainActivity) {
      console.warn('[withAuth0Intent] MainActivity not found');
      return configWithManifest;
    }  // ← Close the if here

    // 4. Remove all intent-filters whose data scheme contains “auth0”
    mainActivity['intent-filter'] = (mainActivity['intent-filter'] || []).filter(
      (ifilter) => {
        if (!ifilter.data) return true;
        return !ifilter.data.some(d =>
          typeof d.$['android:scheme'] === 'string' &&
          d.$['android:scheme'].toLowerCase().includes('auth0')
        );
      }
    );

    // 5. Add the correct lowercase intent-filter
    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [
        { $: { 'android:name': 'android.intent.category.DEFAULT' } },
        { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
      ],
      data: [{
        $: {
          'android:scheme': 'com.aravmathur.badmintonapp.auth0',
          'android:host': 'dev-6oulj204w6qwe4dk.us.auth0.com',
          'android:pathPrefix': '/android/com.aravmathur.badmintonapp/callback',
        },
      }],
    });

    return configWithManifest;
  });
};

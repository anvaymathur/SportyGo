// plugins/withAuth0Intent.js
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAuth0Intent(config) {
  return withAndroidManifest(config, async config => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];
    const mainActivity = application.activity.find(
      a => a['$']['android:name'].endsWith('.MainActivity')
    );
    // Remove any existing auth0 intent-filters
    mainActivity['intent-filter'] = (mainActivity['intent-filter'] || [])
      .filter(ifilter => !(ifilter.data && ifilter.data[0].$['android:scheme'].includes('auth0')));
    // Add the corrected one
    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [
        { $: { 'android:name': 'android.intent.category.DEFAULT' } },
        { $: { 'android:name': 'android.intent.category.BROWSABLE' } }
      ],
      data: [{
        $: {
          'android:scheme': 'com.aravmathur.badmintonapp.auth0',
          'android:host': 'dev-6oulj204w6qwe4dk.us.auth0.com',
          'android:pathPrefix': '/android/com.aravmathur.badmintonapp/callback'
        }
      }]
    });
    return config;
  });
};

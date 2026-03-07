// This module must NEVER import or define any async functions.
// The Facebook SDK scans the entire closure of the FB.login callback
// for the word "async" and throws if found anywhere in scope.

type FBLoginCallback = (accessToken: string | null) => void;

interface FBInstance {
  login: (cb: (response: { authResponse?: { access_token?: string; code?: string } }) => void, opts: Record<string, unknown>) => void;
}

export function fbLoginEmbeddedSignup(
  FB: FBInstance,
  configId: string,
  onResult: FBLoginCallback
): void {
  FB.login(
    function(response) {
      var token = response && response.authResponse && response.authResponse.access_token;
      onResult(token || null);
    },
    {
      config_id: configId,
      response_type: 'token',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: '',
        sessionInfoVersion: '3',
      },
    }
  );
}

// This module must NEVER import or define any async functions.
// The Facebook SDK scans the entire closure of the FB.login callback
// for the word "async" and throws if found anywhere in scope.

type FBLoginCallback = (code: string | null) => void;

interface FBInstance {
  login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
}

export function fbLoginEmbeddedSignup(
  FB: FBInstance,
  configId: string,
  onResult: FBLoginCallback
): void {
  FB.login(
    function(response) {
      var code = response && response.authResponse && response.authResponse.code;
      onResult(code || null);
    },
    {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: '',
        sessionInfoVersion: '3',
      },
    }
  );
}

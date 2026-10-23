// This module must NEVER import or define any async functions.
// The Facebook SDK scans the entire closure of the FB.login callback
// for the word "async" and throws if found anywhere in scope.

// Receives the authorization code, or the access token when responseType is 'token'
type FBLoginCallback = (code: string | null) => void;

interface FBLoginOptions {
  responseType?: 'code' | 'token';
}

interface FBInstance {
  login: (
    cb: (response: { authResponse?: { code?: string; accessToken?: string } }) => void,
    opts: Record<string, unknown>
  ) => void;
}

export function fbLoginEmbeddedSignup(
  FB: FBInstance,
  configId: string,
  onResult: FBLoginCallback,
  opts?: FBLoginOptions
): void {
  var responseType = opts && opts.responseType === 'token' ? 'token' : 'code';
  FB.login(
    function(response) {
      var auth = response && response.authResponse;
      var value = auth && (responseType === 'token' ? auth.accessToken : auth.code);
      onResult(value || null);
    },
    {
      config_id: configId,
      response_type: responseType,
      override_default_response_type: true,
      extras: {
        setup: {},
      },
    }
  );
}

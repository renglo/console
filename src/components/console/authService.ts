// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  AuthenticationResultType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  AuthFlowType,
  ChallengeNameType,
} from "@aws-sdk/client-cognito-identity-provider";

export const cognitoClient = new CognitoIdentityProviderClient({
  region: import.meta.env.VITE_COGNITO_REGION,
});

export type NewPasswordChallenge = {
  kind: "new_password_required";
  session: string;
  /** Username for RespondToAuthChallenge (internal id or sign-in alias). */
  username: string;
  requiredAttributes: string[];
};

export type SignInResult =
  | { kind: "authenticated"; tokens: AuthenticationResultType }
  | NewPasswordChallenge;

function storeAuthenticationResult(result: AuthenticationResultType) {
  sessionStorage.setItem("idToken", result.IdToken || "");
  sessionStorage.setItem("accessToken", result.AccessToken || "");
  sessionStorage.setItem("refreshToken", result.RefreshToken || "");
}

function parseRequiredAttributes(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function challengeUsername(
  signInUsername: string,
  challengeParameters: Record<string, string> | undefined,
): string {
  return challengeParameters?.USER_ID_FOR_SRP?.trim() || signInUsername;
}

export const signIn = async (
  username: string,
  password: string,
): Promise<SignInResult> => {
  const params = {
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  const command = new InitiateAuthCommand(params);
  const response = await cognitoClient.send(command);

  if (response.AuthenticationResult) {
    storeAuthenticationResult(response.AuthenticationResult);
    return {
      kind: "authenticated",
      tokens: response.AuthenticationResult,
    };
  }

  if (
    response.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED &&
    response.Session
  ) {
    return {
      kind: "new_password_required",
      session: response.Session,
      username: challengeUsername(username, response.ChallengeParameters),
      requiredAttributes: parseRequiredAttributes(
        response.ChallengeParameters?.requiredAttributes,
      ),
    };
  }

  throw new Error("Unexpected sign-in response from Cognito.");
};

export const completeNewPasswordChallenge = async (
  username: string,
  newPassword: string,
  session: string,
  userAttributes: Record<string, string> = {},
): Promise<AuthenticationResultType> => {
  const challengeResponses: Record<string, string> = {
    USERNAME: username,
    NEW_PASSWORD: newPassword,
  };

  for (const [key, value] of Object.entries(userAttributes)) {
    if (value.trim()) {
      challengeResponses[`userAttributes.${key}`] = value;
    }
  }

  const command = new RespondToAuthChallengeCommand({
    ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
    ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
    Session: session,
    ChallengeResponses: challengeResponses,
  });

  const response = await cognitoClient.send(command);

  if (!response.AuthenticationResult) {
    throw new Error("Failed to set a new password.");
  }

  storeAuthenticationResult(response.AuthenticationResult);
  return response.AuthenticationResult;
};

export const signUpX = async (email: string, password: string) => {
  const params = {
    ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      {
        Name: "email",
        Value: email,
      },
    ],
  };
  try {
    const command = new SignUpCommand(params);
    const response = await cognitoClient.send(command);
    console.log("Sign up success: ", response);
    return response;
  } catch (error) {
    console.error("Error signing up: ", error);
    throw error;
  }
};

export const signUp = async (email: string, password: string, givenName: string, familyName: string) => {
  const params = {
    ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      {
        Name: "email",
        Value: email,
      },
      {
        Name: "given_name",
        Value: givenName,
      },
      {
        Name: "family_name",
        Value: familyName,
      },
    ],
  };
  try {
    const command = new SignUpCommand(params);
    const response = await cognitoClient.send(command);
    console.log("Sign up success: ", response);
    return response;
  } catch (error) {
    console.error("Error signing up: ", error);
    throw error;
  }
};

export const confirmSignUp = async (username: string, code: string) => {
  const params = {
    ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
  };
  try {
    const command = new ConfirmSignUpCommand(params);
    await cognitoClient.send(command);
    console.log("User confirmed successfully");
    return true;
  } catch (error) {
    console.error("Error confirming sign up: ", error);
    throw error;
  }
};

export const TEST_EMAIL = "e2e-user@example.com";
export const TEST_OTP = "123456";
export const TEST_TOKEN = "e2e-magic-link-token";

export const mockTokens = {
  accessToken: "e2e-access-token",
  refreshToken: "e2e-refresh-token",
};

export const mockProfile = {
  id: "user_e2e_1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: TEST_EMAIL,
  photoURL: null,
  pending: false,
  anonymous: false,
  bodyHeight: null,
  bodyShape: null,
  clothingIdBottom: null,
  clothingIdShoes: null,
  clothingIdTop: null,
  clothingIdMaterial: null,
  skullId: null,
  additionalInfo: null,
  bodyId: null,
  skinColor: null,
  eyeColor: null,
  hairId: null,
  hairColor: null,
  clothingIdMaterialBottom: null,
  clothingIdMaterialShoes: null,
  skull: null,
  clothingTop: null,
  clothingBottom: null,
  clothingShoes: null,
  clothingMaterial: null,
  body: null,
  clothingMaterialBottom: null,
  clothingMaterialShoes: null,
  hair: null,
  deviceId: "e2e-device",
};

export const signinSuccess = {
  statusCode: 200,
  success: true,
  message: "Verification email sent.",
  data: null,
};

export const signinError = {
  statusCode: 400,
  success: false,
  message: "No account found for this email.",
  data: null,
};

export const verifySuccess = {
  statusCode: 200,
  success: true,
  message: "Verified.",
  data: { tokens: mockTokens },
};

export const verifyError = {
  statusCode: 400,
  success: false,
  message: "Invalid or expired code.",
  data: null,
};

export const profileSuccess = {
  statusCode: 200,
  success: true,
  message: "OK",
  data: mockProfile,
};

export const logoutSuccess = {
  statusCode: 200,
  success: true,
  message: "Logged out.",
  data: null,
};

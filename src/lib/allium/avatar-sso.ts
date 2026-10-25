import SSO from "@alliumcloud/avatar-sso";

const sdkKey = import.meta.env.VITE_SSO_SDK_KEY as string | undefined;

if (!sdkKey) {
  console.warn(
    "VITE_SSO_SDK_KEY is not set. Copy .env.example to .env.local and add your SDK key.",
  );
}

export const sso = new SSO({
  sdkKey: sdkKey ?? "",
});

export type * from "@alliumcloud/avatar-sso";

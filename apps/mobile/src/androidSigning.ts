const RELEASE_CONFIG = `        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
`;

const DEBUG_BLOCK = /(signingConfigs \{\n\s+debug \{[^}]*\}\n)(\s+\})/;
const RELEASE_BUILD_TYPE = /(buildTypes \{[\s\S]*?\n\s+release \{[\s\S]*?)signingConfig = signingConfigs\.debug/;

export const SIGNING_MARKER = 'ANDROID_KEYSTORE_PATH';

export function patchReleaseSigning(gradle: string): string {
  if (gradle.includes(SIGNING_MARKER)) return gradle;
  if (!DEBUG_BLOCK.test(gradle)) throw new Error('No se encontro el bloque signingConfigs.debug en build.gradle');
  if (!RELEASE_BUILD_TYPE.test(gradle)) throw new Error('No se encontro signingConfig debug en buildTypes.release');
  const withConfig = gradle.replace(DEBUG_BLOCK, `$1${RELEASE_CONFIG}$2`);
  return withConfig.replace(
    RELEASE_BUILD_TYPE,
    `$1signingConfig = System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug`,
  );
}

export function isDebugCertificate(printedCerts: string): boolean {
  return /Android Debug/i.test(printedCerts);
}

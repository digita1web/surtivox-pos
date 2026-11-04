import { Text } from 'react-native';
import { Screen } from '../src/pos/Screen';
import { LegalDoc } from '../src/pos/LegalDoc';
import { LEGAL_VERSION } from '../src/legal';
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '../src/legalText';
import { useTheme, space } from '../src/theme';

export default function Legal() {
  const t = useTheme();
  const heading = { color: t.accent, fontSize: 18, fontWeight: '800' as const, marginTop: space.md, marginBottom: space.md };
  return (
    <Screen title="Términos y privacidad" subtitle={`Versión ${LEGAL_VERSION}`}>
      <Text style={heading}>Términos y Condiciones</Text>
      <LegalDoc sections={TERMS_SECTIONS} />
      <Text style={[heading, { marginTop: space.xl }]}>Aviso de Privacidad</Text>
      <LegalDoc sections={PRIVACY_SECTIONS} />
    </Screen>
  );
}

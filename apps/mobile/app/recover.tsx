import { useRouter } from 'expo-router';
import { useSession } from '../src/session';
import { showAlert } from '../src/pos/alert';
import { Screen } from '../src/pos/Screen';
import { RecoverBody, RecoverButton, useRecover } from '../src/pos/RecoverForm';

export default function Recover() {
  const router = useRouter();
  const reload = useSession((s) => s.load);
  const state = useRecover(async (restored) => {
    await reload();
    router.replace('/');
    showAlert('Tienda recuperada', `Se descargaron ${restored} registros. Las fotos y el logotipo no viajan en la nube: tendrás que volver a cargarlos.`);
  });

  return (
    <Screen title="Ya tengo mi tienda" footer={<RecoverButton state={state} />}>
      <RecoverBody state={state} />
    </Screen>
  );
}

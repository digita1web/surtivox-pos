import { Text } from 'react-native';
import { Screen } from '../src/pos/Screen';
import { useTheme, space } from '../src/theme';

export default function Licenses() {
  const t = useTheme();
  const title = { color: t.fg, fontSize: 17, fontWeight: '800' as const, marginTop: space.lg, marginBottom: space.xs };
  const body = { color: t.muted, fontSize: 14, lineHeight: 21 };

  return (
    <Screen title="Licencias y atribuciones" subtitle="Atribuciones legales">
      <Text style={title}>Surtivox POS</Text>
      <Text style={body}>
        Punto de venta offline para tiendas de barrio colombianas.
        {'\n\n'}
        Software propietario. Todos los derechos reservados por Mateo Castro.
      </Text>

      <Text style={title}>OpenPocket POS</Text>
      <Text style={body}>
        El código base inicial de Surtivox POS fue heredado de OpenPocket POS, publicado bajo la licencia MIT.
        {'\n\n'}
        Copyright (c) 2026 OpenPocket POS contributors.
        {'\n\n'}
        El aviso original de la licencia MIT se conserva en el proyecto. Todo el código nuevo, las modificaciones y el diseño de Surtivox POS son propiedad exclusiva de Mateo Castro.
      </Text>

      <Text style={title}>Open Food Facts</Text>
      <Text style={body}>
        La app puede consultar nombres, marcas e imágenes de productos en Open Food Facts, un proyecto colaborativo. Su base de datos está disponible bajo la Open Database License (ODbL) 1.0, el contenido individual de la base bajo la Database Contents License (DbCL) y las fotos de productos bajo la licencia Creative Commons Attribution-ShareAlike (CC BY-SA).
        {'\n\n'}
        Atribución: datos de Open Food Facts (https://openfoodfacts.org). Si una foto de producto de esta fuente se guarda en tu tienda, su autoría es de Open Food Facts y de quienes la aportaron.
        {'\n\n'}
        Sitio: https://world.openfoodfacts.org
        {'\n'}
        Licencia de la base: https://opendatacommons.org/licenses/odbl/1-0/
        {'\n\n'}
        Las consultas salen de tu teléfono y se guardan en él para no repetirlas. Los datos de esta fuente no se mezclan con el catálogo comunitario de Surtivox ni se envían como aportes de tu tienda. Las imágenes y marcas de productos pertenecen a sus respectivos titulares. Surtivox POS no modifica precios, inventario ni ventas a partir de esos datos externos.
      </Text>
    </Screen>
  );
}

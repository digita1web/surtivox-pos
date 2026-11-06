export const LEGAL_CONTACT = 'pragramademateo@gmail.com';

export interface LegalSection {
  title: string;
  body: string;
}

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: '1. Aceptación',
    body: 'Al usar Surtivox POS aceptas estos términos y la licencia del software. Si no estás de acuerdo, no uses la aplicación.',
  },
  {
    title: '2. Qué es Surtivox POS',
    body: 'Es una aplicación de punto de venta y gestión para tiendas. Funciona sin conexión y ofrece servicios opcionales de respaldo en la nube, catálogo comunitario y precios de referencia.',
  },
  {
    title: '3. Licencia del software',
    body: 'El software es propiedad exclusiva de Mateo Castro y se ofrece bajo una licencia propietaria: todos los derechos reservados. Queda prohibida la copia, distribución, modificación, sublicenciamiento o uso comercial sin el consentimiento previo y por escrito del titular. El uso en entornos comerciales requiere una licencia comercial. La licencia no concede derechos sobre marcas, logotipos o contenidos de terceros, ni obliga a ofrecer soporte, actualizaciones o mantenimiento.',
  },
  {
    title: '4. Uso permitido',
    body: 'Debes usar la aplicación de forma lícita y respetar los derechos de tus clientes, proveedores y terceros. No debes intentar vulnerar la seguridad de la app, alterar datos de terceros sin autorización, distribuir versiones modificadas ni usarla para fraude o actividades prohibidas.',
  },
  {
    title: '5. Responsabilidad del usuario',
    body: 'Eres responsable de mantener segura tu tienda, tu PIN y tu teléfono; de hacer copias de seguridad de la información importante; de revisar la exactitud de precios, impuestos, ventas, fiados y reportes; y de cumplir tus obligaciones contables, fiscales y de protección al consumidor.',
  },
  {
    title: '6. Servicios de terceros',
    body: 'La app puede interactuar con Cloudflare, Expo, Open Food Facts, catálogos públicos de supermercados y Android. Surtivox no controla su disponibilidad, exactitud o condiciones, que se rigen por sus propias políticas.',
  },
  {
    title: '7. Precios de referencia',
    body: 'Los precios de referencia de supermercados son informativos. No son una oferta, una cotización ni una garantía de precio. La decisión de fijar tus precios de venta es tuya.',
  },
  {
    title: '8. Sin garantías y limitación de responsabilidad',
    body: 'En la máxima medida permitida por la ley, la aplicación se ofrece “tal cual” y “según disponibilidad”, sin garantía de funcionamiento ininterrumpido ni de ausencia de errores, y Surtivox no responde por daños indirectos, pérdida de datos, pérdida de ventas o lucro cesante. Nada de esto excluye derechos irrenunciables que la ley te reconozca como consumidor.',
  },
  {
    title: '9. Asesoría',
    body: 'Surtivox es una herramienta de software. No presta asesoría contable, fiscal, financiera ni legal.',
  },
  {
    title: '10. Propiedad intelectual',
    body: 'Todo el código, diseño e infraestructura de Surtivox POS son propiedad exclusiva de Mateo Castro. Queda prohibida la reproducción total o parcial sin autorización.',
  },
  {
    title: '11. Cambios y contacto',
    body: `Estos términos pueden actualizarse. Cuando cambien, la app te pedirá aceptarlos de nuevo. Para dudas escribe a ${LEGAL_CONTACT}.`,
  },
];

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: '1. Responsable',
    body: `Mateo Castro, titular de Surtivox POS. Contacto: ${LEGAL_CONTACT}.`,
  },
  {
    title: '2. Qué guarda la app en tu teléfono',
    body: 'Productos, precios, ventas, pagos, compras, proveedores, personal (nombre, rol y una huella de su PIN), clientes y fiados (nombre, teléfono y lo que escribas), fotos de productos y los datos de tu tienda. Todo queda en una base de datos dentro de tu teléfono. Surtivox no tiene acceso a esos datos, salvo que actives el respaldo en la nube.',
  },
  {
    title: '3. Consultas por internet que hace la app',
    body: 'Aunque no actives nada, la app puede conectarse a internet para: (a) buscar actualizaciones al abrirse, en el servicio de actualizaciones de Expo; (b) consultar un código de barras que no tienes registrado, en Open Food Facts y en el catálogo comunitario de Surtivox (solo se envía el código); y (c) traer precios de referencia, enviando el código de barras a un servicio de Surtivox que consulta catálogos públicos de supermercados. Como en cualquier conexión a internet, el servicio que responde puede ver la dirección IP de tu conexión.',
  },
  {
    title: '4. Respaldo en la nube (solo si lo activas)',
    body: 'Se guarda en servidores de Cloudflare, que pueden estar fuera de Colombia: tu tienda, productos, categorías, proveedores, personal (nombre, rol y huella del PIN), clientes y fiados (con sus nombres, teléfonos y notas), ventas, pagos, compras y devoluciones. Las fotos de productos no se envían. El código de tu tienda da acceso a esos datos: no lo compartas. Eres responsable de contar con la autorización de tus clientes; Surtivox almacena sus datos por encargo tuyo. Si desactivas el respaldo, los datos ya enviados siguen en el servidor hasta que pidas su supresión.',
  },
  {
    title: '5. Catálogo comunitario (solo si lo activas)',
    body: 'Si aceptas ayudar al catálogo, cuando escribas o corrijas el nombre de un producto con código de barras se envía a Surtivox el código de barras, el nombre y la presentación, junto con un identificador aleatorio de tu instalación. No se envían precios, ventas, clientes, el nombre ni el identificador de tu tienda. Es una contribución seudónima, no anónima. Lo que ya enviaste no se borra automáticamente del catálogo compartido. Puedes dejar de participar en Más → Privacidad.',
  },
  {
    title: '6. Para qué se usan los datos',
    body: 'Para que la app funcione, para ofrecerte el respaldo y la sincronización entre tus dispositivos si los activas, y para construir el catálogo comunitario si participas.',
  },
  {
    title: '7. Tus derechos',
    body: `Según la Ley 1581 de 2012 puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos personales, revocar tu autorización y presentar quejas ante la Superintendencia de Industria y Comercio. Escríbenos a ${LEGAL_CONTACT}. Los datos de tu teléfono los controlas tú: Más → Borrar todos los datos de la app los elimina, pero no borra lo que ya esté en la nube.`,
  },
  {
    title: '8. Conservación',
    body: 'Los datos de tu teléfono se conservan hasta que los borres. Los datos de la nube y del catálogo se conservan mientras el servicio esté activo o hasta que solicites su supresión.',
  },
  {
    title: '9. Cambios',
    body: 'Si este aviso cambia de forma importante, la app te pedirá aceptarlo de nuevo.',
  },
];

export const CATALOG_NOTICE = {
  title: '¿Quieres ayudar a otros tenderos?',
  body: [
    'Si lo activas, cuando escribas o corrijas el nombre de un producto con código de barras, enviaremos a Surtivox solo el código de barras, el nombre y la presentación (por ejemplo, 500 g).',
    'No enviamos precios, ventas, clientes ni datos de tu tienda.',
    'Tu aporte lleva un identificador aleatorio de tu app, no tu nombre. No es anonimato total, y lo que ya enviaste no se puede borrar del catálogo compartido.',
    'Puedes apagarlo cuando quieras en Más → Privacidad.',
  ],
  rights: `Tus derechos: conocer, corregir o suprimir tus datos y revocar tu autorización escribiendo a ${LEGAL_CONTACT}.`,
  yes: 'Sí, quiero ayudar',
  no: 'Ahora no',
} as const;

export const CLOUD_NOTICE = {
  title: 'Activar respaldo en la nube',
  body: 'Se guardará una copia de tu tienda en servidores de Cloudflare, que pueden estar fuera de Colombia: productos, ventas, pagos, compras, proveedores, personal y tus clientes de fiado, con sus nombres y teléfonos. Las fotos no se envían. El código de tu tienda da acceso a esos datos: no lo compartas. Eres responsable de contar con la autorización de tus clientes. Más información en Más → Términos y privacidad.',
  confirm: 'Activar',
  cancel: 'Cancelar',
} as const;

export const PHOTO_TIP = 'Tip: para una foto más clara, ponla sobre una hoja blanca y con buena luz.';

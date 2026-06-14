import { P, Bullets, Section, Sub, Note, Defs, Table, Contact, Summary } from "./legalUi";

/**
 * Política de Privacidad — cuerpo del documento (el shell + metadatos los pone LegalPages).
 * Redactada a estándar GDPR/UK-GDPR (la vara más alta) y mapeada a CCPA/CPRA, Ley 25.326 (AR),
 * Ley 19.628 / 21.719 (CL) y LGPD (BR). Cada afirmación coincide con lo que el sistema realmente
 * hace (opt-in del ciclo, cifrado at-rest, redacción server-side al coach, exportación/borrado,
 * sin venta de datos) — es un documento operativo, no decorativo.
 */
export function PrivacyContent() {
  return (
    <>
      <P>
        En Holy Oly tu confianza es el producto. Esta política explica, en lenguaje claro, qué datos
        tratamos, con qué finalidad y base legal, dónde se alojan, con quién se comparten y qué control
        tenés sobre ellos. Prestamos especial cuidado a los <strong>datos de salud</strong> y, en
        particular, al <strong>registro del ciclo menstrual</strong>, que es siempre opcional, está
        cifrado y bajo tu control.
      </P>

      <Summary
        items={[
          "Tratamos sólo los datos necesarios para que coach y atleta coordinen el entrenamiento. No vendemos tus datos ni los usamos para publicidad.",
          "El registro del ciclo es 100% opcional (opt-in explícito), se almacena cifrado y tu coach jamás ve el dato crudo — sólo una proyección redactada que vos elegís compartir.",
          "Podés exportar todos tus datos o eliminar tu cuenta vos mismo desde la app, en cualquier momento.",
          "Nuestra infraestructura está en EE.UU. (Oregón): usar la app implica una transferencia internacional, que aceptás de forma informada.",
          "Tenés derechos de acceso, rectificación, supresión, portabilidad, oposición y a retirar tu consentimiento.",
        ]}
      />

      <Section n={1} id="responsable" title="Responsable del tratamiento">
        <P>
          El responsable del tratamiento de tus datos es Holy Oly, operado por su titular (en adelante,
          «Holy Oly», «nosotros»). Podés contactarnos para cualquier asunto de privacidad, o para
          ejercer tus derechos, en <Contact />. La identificación registral completa del responsable
          (denominación, domicilio legal e identificación tributaria) está disponible a pedido a través
          de ese correo y se publicará al constituirse formalmente la entidad.
        </P>
      </Section>

      <Section n={2} id="alcance" title="A quién y a qué aplica">
        <P>
          Esta política aplica a toda persona que use Holy Oly —atletas y coaches— y a los datos que
          tratamos a través de la aplicación web y nuestra API. No aplica a sitios o servicios de
          terceros que enlacemos, que se rigen por sus propias políticas.
        </P>
      </Section>

      <Section n={3} id="definiciones" title="Definiciones">
        <Defs
          items={[
            ["Datos personales", "toda información sobre una persona física identificada o identificable."],
            ["Datos sensibles / categorías especiales", "datos que merecen protección reforzada — aquí, los datos de salud, incluido el registro del ciclo menstrual."],
            ["Tratamiento", "cualquier operación sobre datos personales (recolectar, almacenar, usar, compartir, borrar)."],
            ["Responsable", "quien decide los fines y medios del tratamiento (Holy Oly)."],
            ["Encargado / subprocesador", "quien trata datos por cuenta del responsable (p. ej. el proveedor de hosting)."],
            ["Coach y atleta", "los dos roles de la app; el coach programa el entrenamiento, el atleta lo ejecuta y reporta."],
          ]}
        />
      </Section>

      <Section n={4} id="datos" title="Qué datos tratamos">
        <Table
          head={["Categoría", "Ejemplos", "¿Obligatorio?", "Base legal"]}
          rows={[
            ["Identidad y cuenta", "email, contraseña (almacenada con hash), nombre, rol (coach/atleta); o tu identidad de Google si entrás con OAuth", "Sí — para tener cuenta", "Ejecución del contrato"],
            ["Entrenamiento", "plan, ejercicios, kilos, series y repeticiones, asistencia, fechas de sesión, marcas", "Sí — es el núcleo del servicio", "Ejecución del contrato"],
            ["Bienestar (check-in)", "fatiga, dolor, estrés, ánimo, motivación, sueño y peso corporal, si los cargás", "No — opcional", "Ejecución del contrato"],
            [<><strong>Ciclo menstrual</strong> (dato sensible)</>, "el hecho de que registrás, el estado (regular/irregular/sin período) y, si los cargás, inicio del último período y duración típica", "No — opt-in explícito", "Tu consentimiento explícito"],
            ["Facturación (coaches)", "plan, estado de la suscripción e identificadores del proveedor de pago", "Sólo si te suscribís", "Ejecución del contrato y obligación legal"],
            ["Datos técnicos", "dirección IP, fecha/hora y tipo de solicitud, cookie de sesión, registros de seguridad y auditoría", "Se generan al usar la app", "Interés legítimo (seguridad)"],
            ["Comunicaciones", "emails de verificación, restablecimiento de contraseña y soporte", "Según el uso", "Ejecución del contrato"],
          ]}
        />
        <P>
          <strong>No</strong> tratamos números de tarjeta (los procesa el proveedor de pago), datos
          biométricos, geolocalización ni identificadores publicitarios.
        </P>
      </Section>

      <Section n={5} id="origen" title="Cómo obtenemos tus datos">
        <Bullets
          items={[
            <><strong>De vos:</strong> al registrarte, cargar tu entrenamiento, tu check-in o tu ciclo.</>,
            <><strong>Automáticamente:</strong> registros técnicos y la cookie de sesión cuando usás la app.</>,
            <><strong>De tu coach o atleta vinculado:</strong> el plan y la prescripción que tu coach crea para vos (o que vos, como coach, creás para tus atletas).</>,
            <><strong>De Google:</strong> si elegís iniciar sesión con Google, recibimos los datos mínimos de tu cuenta para identificarte.</>,
          ]}
        />
      </Section>

      <Section n={6} id="finalidades" title="Para qué los usamos y con qué base legal">
        <Bullets
          items={[
            <><strong>Prestarte el servicio</strong> (coordinar el plan entre coach y atleta, mostrar tu progreso): ejecución del contrato.</>,
            <><strong>Proyectar y, si lo elegís, compartir el contexto redactado de tu ciclo:</strong> tu consentimiento explícito (puede retirarse en cualquier momento).</>,
            <><strong>Seguridad, prevención de fraude y abuso, y registros de auditoría:</strong> interés legítimo.</>,
            <><strong>Facturar suscripciones de coach</strong> y cumplir obligaciones contables/fiscales: ejecución del contrato y obligación legal.</>,
            <><strong>Comunicaciones del servicio</strong> (verificación de email, restablecimiento de contraseña): ejecución del contrato.</>,
            <><strong>Cumplir requerimientos legales válidos:</strong> obligación legal.</>,
          ]}
        />
      </Section>

      <Section n={7} id="ciclo" title="Datos del ciclo menstrual (categoría especial)">
        <P>
          El registro del ciclo recibe el trato más estricto de toda la app. Estos son nuestros
          compromisos, que el sistema cumple técnicamente:
        </P>
        <Bullets
          items={[
            <><strong>Opt-in por elección:</strong> el módulo permanece invisible hasta que vos lo activás dando tu consentimiento informado. Nunca se asume por tu género ni se activa por defecto.</>,
            <><strong>Qué tratamos:</strong> el hecho de que registrás, el estado (regular/irregular/sin período) y, sólo si los cargás, la fecha de inicio del último período y la duración típica del ciclo.</>,
            <><strong>Para qué:</strong> proyectar las ventanas de tu ciclo sobre TU propio calendario de entrenamiento y, sólo si lo elegís, dar a tu coach un contexto redactado.</>,
            <><strong>Qué ve tu coach:</strong> vos elegís el nivel (Nada / Mínimo / Contexto). Incluso en «Contexto», tu coach jamás ve tu fecha, tu fase ni síntomas: sólo una señal, calculada en nuestro servidor, de si hoy estás en ventana lútea. El dato crudo nunca viaja al coach.</>,
            <><strong>Qué NO hacemos:</strong> no lo vendemos, no lo usamos para publicidad ni perfilado comercial, y no lo compartimos con terceros más allá de los subprocesadores estrictamente necesarios para alojarlo de forma segura.</>,
            <><strong>Cifrado:</strong> se almacena cifrado (AES-256-GCM) en reposo.</>,
            <><strong>Tu control total:</strong> podés editarlo, cambiar qué compartís, retirar el consentimiento y borrar todo el registro cuando quieras. Al revocar, tu coach deja de ver cualquier contexto de inmediato.</>,
            <><strong>Conservación:</strong> hasta que lo borres o elimines tu cuenta.</>,
            <><strong>Base legal:</strong> tu consentimiento explícito. Para residentes de California, lo tratamos como «información personal sensible» con uso limitado a prestarte el servicio.</>,
          ]}
        />
        <Note>
          El registro del ciclo es una herramienta de contexto para tu entrenamiento. <strong>No es un
          diagnóstico ni reemplaza el consejo de un profesional de la salud.</strong>
        </Note>
      </Section>

      <Section n={8} id="cookies" title="Cookies y tecnologías similares">
        <Bullets
          items={[
            <><strong>Cookie de sesión (estrictamente necesaria):</strong> mantiene tu sesión iniciada de forma segura (httpOnly). Es esencial para el servicio y no requiere consentimiento.</>,
            <><strong>Google</strong> (si elegís entrar con Google): Google puede usar sus propias cookies; se rige por su política.</>,
            <><strong>Mercado Pago</strong> (si te suscribís como coach): cookies del proveedor durante el proceso de pago.</>,
          ]}
        />
        <P>
          No usamos cookies de publicidad, analítica de terceros ni rastreadores de seguimiento entre
          sitios. Podés gestionar las cookies desde tu navegador; bloquear la cookie de sesión te
          impedirá iniciar sesión.
        </P>
      </Section>

      <Section n={9} id="comparte" title="Con quién compartimos tus datos">
        <P>Recurrimos a un conjunto mínimo de proveedores (encargados del tratamiento):</P>
        <Table
          head={["Proveedor", "Finalidad", "Ubicación", "Salvaguardas"]}
          rows={[
            ["Render", "Hosting de la app y base de datos", "EE.UU. (Oregón)", "Cláusulas contractuales tipo (SCC); cifrado en tránsito"],
            ["Google", "Emails transaccionales; inicio de sesión con Google (opcional)", "EE.UU. / global", "SCC; tu consentimiento al usar Google"],
            ["Mercado Pago", "Cobro de suscripciones de coach", "Según tu país", "Estándares del proveedor (PCI-DSS); sus términos y política"],
          ]}
        />
        <P>
          <strong>No vendemos ni alquilamos tus datos.</strong> Tu coach accede únicamente a lo que
          corresponde a un vínculo aceptado por ambas partes y, del ciclo, sólo a la proyección
          redactada que vos elegiste. Podemos divulgar datos si la ley válidamente lo exige (p. ej. una
          orden judicial), procurando notificarte salvo prohibición legal.
        </P>
      </Section>

      <Section n={10} id="transferencias" title="Transferencias internacionales">
        <P>
          Tus datos se alojan y procesan en <strong>EE.UU. (Oregón)</strong>. Si estás en la Unión
          Europea/EEE, el Reino Unido, Argentina, Chile u otro país, usar la app implica una
          transferencia internacional de datos.
        </P>
        <Bullets
          items={[
            <>Para residentes del <strong>EEE/Reino Unido</strong>, la transferencia se ampara en las Cláusulas Contractuales Tipo (SCC) de nuestros proveedores y/o en tu consentimiento explícito e informado (GDPR art. 49.1.a) prestado al crear tu cuenta, habiendo sido informado de que el país de destino puede no ofrecer garantías equivalentes (p. ej. posibilidad de acceso por autoridades).</>,
            <>Los <strong>datos del ciclo</strong> se transfieren únicamente con tu consentimiento explícito y siempre cifrados.</>,
            <>Podés solicitar más información sobre las salvaguardas escribiéndonos a <Contact />.</>,
          ]}
        />
      </Section>

      <Section n={11} id="conservacion" title="Cuánto tiempo los conservamos">
        <Table
          head={["Dato", "Plazo de conservación"]}
          rows={[
            ["Cuenta y entrenamiento", "Mientras tu cuenta esté activa; se eliminan al borrar la cuenta"],
            ["Ciclo menstrual", "Hasta que lo revoques/borres o elimines tu cuenta"],
            ["Facturación (coaches)", "Los plazos contables y fiscales legalmente exigibles tras la baja"],
            ["Registros de seguridad/auditoría", "Período limitado; sólo identificadores, acción e IP — nunca datos de salud"],
            ["Copias de respaldo", "Rotación periódica; lo borrado se purga de los backups en el ciclo de rotación"],
          ]}
        />
      </Section>

      <Section n={12} id="seguridad" title="Cómo protegemos tus datos">
        <Bullets
          items={[
            "Cifrado en tránsito (HTTPS/TLS) en todo el servicio.",
            "Cifrado en reposo de los datos del ciclo (AES-256-GCM).",
            "Contraseñas con hashing fuerte (Argon2id); nunca se almacenan en claro.",
            "Sesiones de servidor revocables; podés cerrar la sesión en todos tus dispositivos.",
            "Control de acceso: un coach sólo ve datos de una atleta con un vínculo aceptado, y del ciclo sólo la proyección redactada.",
            "Registro de auditoría sin datos sensibles (sólo identificadores, acción e IP).",
            "Minimización de datos: tratamos únicamente lo necesario.",
          ]}
        />
        <P>
          Ningún sistema es completamente infalible, pero aplicamos medidas técnicas y organizativas
          razonables y proporcionales al riesgo para proteger tus datos.
        </P>
      </Section>

      <Section n={13} id="incidentes" title="Notificación de incidentes de seguridad">
        <P>
          Si se produce una violación de la seguridad que afecte tus datos personales, la evaluaremos
          sin demora y, cuando corresponda, la notificaremos a la autoridad de control competente y a vos
          conforme a la ley aplicable (por ejemplo, bajo el GDPR: a la autoridad dentro de las 72 horas
          cuando proceda, y a vos sin demora indebida si existe un alto riesgo para tus derechos).
        </P>
      </Section>

      <Section n={14} id="derechos" title="Tus derechos">
        <Bullets
          items={[
            <><strong>Acceso:</strong> saber qué datos tratamos y obtener una copia.</>,
            <><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</>,
            <><strong>Supresión («derecho al olvido»):</strong> borrar tu cuenta y tus datos.</>,
            <><strong>Limitación:</strong> restringir el tratamiento en los casos previstos por la ley.</>,
            <><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común (JSON).</>,
            <><strong>Oposición:</strong> oponerte a los tratamientos basados en nuestro interés legítimo.</>,
            <><strong>Retirar el consentimiento:</strong> cuando quieras (p. ej. desactivar el ciclo), sin afectar la licitud del tratamiento previo.</>,
            <><strong>No ser objeto de decisiones automatizadas</strong> con efecto jurídico o significativo: no realizamos ese tipo de decisiones (ver §16).</>,
            <><strong>Reclamar</strong> ante una autoridad de control (ver §19).</>,
          ]}
        />
        <P>
          <strong>Cómo ejercerlos:</strong> desde la app, en Cuenta → «Tus datos», podés <strong>exportar</strong>
          todos tus datos y <strong>eliminar</strong> tu cuenta vos mismo. También podés escribirnos a <Contact />.
          Responderemos sin demora y, a más tardar, dentro del plazo que fije tu legislación (en la UE, un
          mes, prorrogable). El ejercicio es gratuito, salvo solicitudes manifiestamente infundadas o excesivas.
        </P>
      </Section>

      <Section n={15} id="region" title="Tus derechos según dónde estés">
        <Sub title="Unión Europea / EEE y Reino Unido (GDPR / UK GDPR)">
          <P>Tenés todos los derechos del §14. La transferencia a EE.UU. se rige por el §10. Podés reclamar ante tu autoridad local o la del lugar de la presunta infracción.</P>
        </Sub>
        <Sub title="California (CCPA / CPRA)">
          <P>Derecho a saber, eliminar y corregir; a optar por que no se «venda» ni «comparta» tu información (no lo hacemos en ningún sentido); a limitar el uso de tu información personal sensible (tratamos el ciclo con uso limitado); y a no sufrir discriminación por ejercer tus derechos. No vendimos ni compartimos información personal en los últimos doce meses.</P>
        </Sub>
        <Sub title="Argentina (Ley 25.326)">
          <P>Derechos de acceso, rectificación, actualización y supresión. Los datos de salud son datos sensibles con protección reforzada. Podés reclamar ante la Agencia de Acceso a la Información Pública (AAIP).</P>
        </Sub>
        <Sub title="Chile (Ley 19.628 y Ley 21.719)">
          <P>Derechos de acceso, rectificación, cancelación/supresión y oposición, con protección reforzada de los datos sensibles.</P>
        </Sub>
        <Sub title="Brasil (LGPD) y otros países">
          <P>Derechos de confirmación, acceso, corrección, anonimización/bloqueo/eliminación, portabilidad e información sobre el uso compartido. En cualquier otro país, respetamos los derechos que te otorgue tu legislación local.</P>
        </Sub>
      </Section>

      <Section n={16} id="automatizadas" title="Decisiones automatizadas y perfilado">
        <P>
          No tomamos decisiones automatizadas que produzcan efectos jurídicos o significativos sobre vos.
          La programación del entrenamiento la decide tu coach, que es una persona. Las proyecciones (del
          ciclo, mapas de intensidad) son informativas y no deciden por vos.
        </P>
      </Section>

      <Section n={17} id="menores" title="Menores de edad">
        <P>
          El servicio está dirigido a personas mayores de edad. No está dirigido a menores de 18 años; si
          sos menor de edad, sólo podés usarlo con la autorización y supervisión de tu representante legal.
          Si advertimos que tratamos datos de un menor sin esa autorización, los eliminaremos.
        </P>
      </Section>

      <Section n={18} id="cambios" title="Cambios a esta política">
        <P>
          Podemos actualizar esta política. Si el cambio es material, te lo informaremos por un medio
          razonable (en la app o por email) y, cuando la ley lo requiera o el cambio afecte un tratamiento
          basado en tu consentimiento, te pediremos que la aceptes nuevamente antes de continuar. La
          versión vigente y su fecha figuran al inicio del documento.
        </P>
      </Section>

      <Section n={19} id="autoridades" title="Reclamos ante autoridades de control">
        <P>Sin perjuicio de cualquier otro recurso, tenés derecho a presentar un reclamo ante la autoridad competente:</P>
        <Bullets
          items={[
            <><strong>Argentina:</strong> Agencia de Acceso a la Información Pública (AAIP).</>,
            <><strong>UE/EEE:</strong> tu autoridad de protección de datos local.</>,
            <><strong>Reino Unido:</strong> Information Commissioner's Office (ICO).</>,
            <><strong>Chile:</strong> la autoridad de protección de datos competente.</>,
            <><strong>California:</strong> California Privacy Protection Agency (CPPA) o el Fiscal General del Estado.</>,
          ]}
        />
        <P>Te agradecemos que, antes, nos des la oportunidad de resolverlo escribiéndonos a <Contact />.</P>
      </Section>

      <Section n={20} id="contacto" title="Contacto">
        <P>
          Para cualquier consulta sobre esta política, sobre tus datos o para ejercer tus derechos,
          escribinos a <Contact />. Atendemos las solicitudes de privacidad con prioridad.
        </P>
      </Section>
    </>
  );
}
